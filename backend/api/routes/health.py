from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def get_health():
    """Health check endpoint to test connection status."""
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }
