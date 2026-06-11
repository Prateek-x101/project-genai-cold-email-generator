from fastapi import APIRouter
from backend.models.schemas import SearchJobsRequest, SearchJobsResponse
from backend.services.job_search_service import search_jobs_api

router = APIRouter()

@router.post("/search-jobs", response_model=SearchJobsResponse)
async def api_search_jobs(request: SearchJobsRequest):
    """
    Queries external job search provider APIs (RemoteOK, JSearch, Adzuna) for job openings.
    """
    try:
        jobs = await search_jobs_api(
            query=request.query,
            location=request.location,
            provider=request.provider,
            api_key=request.api_key,
            page=request.page
        )
        return SearchJobsResponse(success=True, jobs=jobs)
    except Exception as e:
        return SearchJobsResponse(success=False, jobs=[], error=str(e))
