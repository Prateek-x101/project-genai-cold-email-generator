from fastapi import APIRouter
from backend.models.schemas import (
    LoadPortfolioRequest, LoadPortfolioResponse,
    QueryPortfolioRequest, QueryPortfolioResponse
)
from backend.services.portfolio_service import PortfolioService

router = APIRouter()

# Instantiate service globally
portfolio_service = PortfolioService()

@router.post("/load", response_model=LoadPortfolioResponse)
async def api_load_portfolio(request: LoadPortfolioRequest):
    """
    Clears the local ChromaDB vector store and reloads it with new tech stack and portfolio links.
    """
    try:
        portfolio_service.load_portfolio(request.items)
        return LoadPortfolioResponse(success=True, message="Portfolio database loaded successfully!")
    except Exception as e:
        return LoadPortfolioResponse(success=False, message="", error=str(e))

@router.post("/query", response_model=QueryPortfolioResponse)
async def api_query_portfolio(request: QueryPortfolioRequest):
    """
    Queries ChromaDB to find relevant portfolio links matching specified skills.
    """
    try:
        links = portfolio_service.query_links(request.skills, n_results=request.n_results)
        return QueryPortfolioResponse(success=True, links=links)
    except Exception as e:
        return QueryPortfolioResponse(success=False, links=[], error=str(e))
