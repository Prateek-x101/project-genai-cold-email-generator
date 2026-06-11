from fastapi import APIRouter
from backend.models.schemas import FindContactsRequest, FindContactsResponse
from backend.services.contact_finder_service import find_contacts_service

router = APIRouter()

@router.post("/find-contacts", response_model=FindContactsResponse)
async def api_find_contacts(request: FindContactsRequest):
    """
    Attempts to discover contact emails for a company using multiple strategies.
    """
    try:
        contacts = await find_contacts_service(
            company=request.company,
            page_url=request.page_url,
            page_content=request.page_content
        )
        return FindContactsResponse(success=True, contacts=contacts)
    except Exception as e:
        return FindContactsResponse(success=False, contacts=[], error=str(e))
