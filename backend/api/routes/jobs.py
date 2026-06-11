from fastapi import APIRouter, HTTPException
from backend.models.schemas import ExtractJobsRequest, ExtractJobsResponse, Job
from backend.core.chains import extract_jobs
from backend.utils.text_cleaner import clean_text

router = APIRouter()

@router.post("/extract-jobs", response_model=ExtractJobsResponse)
async def api_extract_jobs(request: ExtractJobsRequest):
    """
    Extracts structured job postings from scraped raw web content using LLM.
    """
    try:
        # Pre-clean text to reduce token size and filter out scripts
        cleaned = clean_text(request.page_content)
        if not cleaned:
            return ExtractJobsResponse(success=False, jobs=[], error="Scraped page text is empty after cleaning.")

        raw_jobs = extract_jobs(
            page_content=cleaned,
            provider=request.provider,
            api_key=request.api_key,
            model_name=request.model_name
        )
        
        jobs_list = []
        for rj in raw_jobs:
            jobs_list.append(Job(
                role=rj.get("role", "Unknown Role"),
                company=rj.get("company", "Unknown Company"),
                experience=rj.get("experience", "Not specified"),
                skills=rj.get("skills", []),
                description=rj.get("description", ""),
                source_url=request.page_url
            ))
            
        return ExtractJobsResponse(success=True, jobs=jobs_list)
    except Exception as e:
        return ExtractJobsResponse(success=False, jobs=[], error=str(e))
