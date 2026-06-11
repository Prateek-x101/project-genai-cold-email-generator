import requests
from fastapi import APIRouter, HTTPException
from backend.models.schemas import FetchModelsRequest, FetchModelsResponse

router = APIRouter()

@router.post("/models", response_model=FetchModelsResponse)
async def api_fetch_models(request: FetchModelsRequest):
    """
    Fetches available models for a given LLM provider in real-time.
    """
    provider = request.provider.strip().lower()
    api_key = request.api_key.strip()
    
    if not api_key:
        return FetchModelsResponse(success=False, models=[], error="API key is missing.")
        
    try:
        if provider == "groq":
            headers = {"Authorization": f"Bearer {api_key}"}
            res = requests.get("https://api.groq.com/openai/v1/models", headers=headers, timeout=5)
            if res.status_code == 200:
                data = res.json()
                models = [m["id"] for m in data.get("data", [])]
                # Sort models to prioritize versatile and preview ones
                models.sort()
                return FetchModelsResponse(success=True, models=models)
            else:
                return FetchModelsResponse(
                    success=False,
                    models=[],
                    error=f"Groq API returned status {res.status_code}: {res.text}"
                )
                
        elif provider == "openai":
            headers = {"Authorization": f"Bearer {api_key}"}
            res = requests.get("https://api.openai.com/v1/models", headers=headers, timeout=5)
            if res.status_code == 200:
                data = res.json()
                all_models = [m["id"] for m in data.get("data", [])]
                # Filter to common chat models
                chat_models = [
                    m for m in all_models 
                    if m.startswith("gpt") or m.startswith("o1") or m.startswith("o3")
                ]
                chat_models.sort()
                return FetchModelsResponse(success=True, models=chat_models)
            else:
                return FetchModelsResponse(
                    success=False,
                    models=[],
                    error=f"OpenAI API returned status {res.status_code}: {res.text}"
                )
                
        elif provider == "gemini":
            # Gemini models list API is relatively complex to query directly and changes less often.
            # We return a recommended, up-to-date, curated list of Gemini models.
            recommended_models = [
                "gemini-1.5-flash",
                "gemini-1.5-pro",
                "gemini-2.0-flash-exp",
                "gemini-2.5-flash",
                "gemini-2.5-pro"
            ]
            return FetchModelsResponse(success=True, models=recommended_models)
            
        else:
            return FetchModelsResponse(success=False, models=[], error=f"Unsupported LLM provider: {provider}")
            
    except Exception as e:
        return FetchModelsResponse(success=False, models=[], error=f"Request failed: {str(e)}")
