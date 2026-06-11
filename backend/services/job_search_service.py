import requests
from backend.models.schemas import Job

async def search_jobs_api(
    query: str,
    location: str = "",
    provider: str = "remoteok",
    api_key: str = "",
    page: int = 1
) -> list[Job]:
    """
    Search jobs from external APIs based on query and location.
    Supported: remoteok (free, no key), jsearch (RapidAPI), adzuna.
    """
    query = query.strip()
    jobs = []
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    if provider == "remoteok":
        # RemoteOK Free JSON endpoint
        try:
            url = f"https://remoteok.com/api?tag={requests.utils.quote(query)}"
            res = requests.get(url, headers=headers, timeout=10)
            if res.ok:
                data = res.json()
                # Index 0 is info/rules dictionary, job records start at Index 1
                if isinstance(data, list) and len(data) > 1:
                    for item in data[1:]:
                        jobs.append(Job(
                            role=item.get("position", ""),
                            company=item.get("company", ""),
                            description=BeautifulSoupTextOnly(item.get("description", "")),
                            skills=item.get("tags", []),
                            source_url=item.get("url", "")
                        ))
        except Exception as e:
            print(f"[SearchService] RemoteOK failed: {e}")
            raise RuntimeError(f"RemoteOK API search failed: {str(e)}")

    elif provider == "jsearch":
        # JSearch (LinkedIn, Indeed aggregator on RapidAPI)
        if not api_key:
            raise ValueError("JSearch requires a valid RapidAPI Key.")
            
        try:
            url = "https://jsearch.p.rapidapi.com/search"
            params = {
                "query": f"{query} in {location}" if location else query,
                "page": str(page),
                "num_pages": "1"
            }
            jsearch_headers = {
                **headers,
                "X-RapidAPI-Key": api_key,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
            }
            res = requests.get(url, headers=jsearch_headers, params=params, timeout=12)
            
            # If request fails, extract detailed RapidAPI message
            if not res.ok:
                detail_msg = res.text
                try:
                    detail_json = res.json()
                    if "message" in detail_json:
                        detail_msg = detail_json["message"]
                except:
                    pass
                raise RuntimeError(f"{res.status_code} client/server error: {detail_msg}")
                
            data = res.json()
            
            if "data" in data and isinstance(data["data"], list):
                for item in data["data"]:
                    jobs.append(Job(
                        role=item.get("job_title", ""),
                        company=item.get("employer_name", ""),
                        description=item.get("job_description", ""),
                        skills=[s.strip() for s in item.get("job_required_skills", []) if s] if item.get("job_required_skills") else [],
                        source_url=item.get("job_apply_link", "")
                    ))
        except Exception as e:
            print(f"[SearchService] JSearch failed: {e}")
            raise RuntimeError(f"JSearch API search failed: {str(e)}")

    elif provider == "adzuna":
        # Adzuna API (requires App ID and App Key split by colon: 'app_id:app_key')
        if not api_key or ":" not in api_key:
            raise ValueError("Adzuna requires API Key formatted as 'APP_ID:APP_KEY'.")
            
        try:
            app_id, app_key = api_key.split(":", 1)
            # Default country: us
            url = f"https://api.adzuna.com/v1/api/jobs/us/search/{page}"
            params = {
                "app_id": app_id.strip(),
                "app_key": app_key.strip(),
                "what": query,
                "content-type": "application/json"
            }
            if location:
                params["where"] = location
                
            res = requests.get(url, headers=headers, params=params, timeout=12)
            res.raise_for_status()
            data = res.json()
            
            if "results" in data and isinstance(data["results"], list):
                for item in data["results"]:
                    # adzuna has categories or tags
                    category = item.get("category", {}).get("label", "")
                    skills = [category] if category else []
                    
                    jobs.append(Job(
                        role=item.get("title", ""),
                        company=item.get("company", {}).get("display_name", ""),
                        description=item.get("description", ""),
                        skills=skills,
                        source_url=item.get("redirect_url", "")
                    ))
        except Exception as e:
            print(f"[SearchService] Adzuna failed: {e}")
            raise RuntimeError(f"Adzuna API search failed: {str(e)}")
            
    else:
        raise ValueError(f"Unknown job search provider: {provider}")

    return jobs

def BeautifulSoupTextOnly(html_content: str) -> str:
    """Helper to strip tags from search API descriptions."""
    if not html_content:
        return ""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, "html.parser")
        return soup.get_text(separator=" ")
    except:
        # Fallback raw regex tag removal
        import re
        return re.sub(r'<[^>]*?>', '', html_content)
