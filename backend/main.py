import sys
from pathlib import Path
# Add parent directory of backend to python path to support absolute backend.* imports
sys.path.append(str(Path(__file__).resolve().parent.parent))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config import settings

# Import API routes
from backend.api.routes import health, jobs, emails, contacts, search, portfolio, models

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API server for ColdCraft AI Chrome Extension outreach automation."
)

# Configure CORS Middleware
# We allow the Chrome extension scheme specifically (chrome-extension://*) and local testing origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow wildcards to guarantee Chrome extension compatibility across installs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(jobs.router, prefix=settings.API_V1_STR, tags=["Job Extraction"])
app.include_router(emails.router, prefix=settings.API_V1_STR, tags=["Emails"])
app.include_router(contacts.router, prefix=settings.API_V1_STR, tags=["Contact Finder"])
app.include_router(search.router, prefix=settings.API_V1_STR, tags=["Job Search"])
app.include_router(portfolio.router, prefix=f"{settings.API_V1_STR}/portfolio", tags=["Portfolio Database"])
app.include_router(models.router, prefix=settings.API_V1_STR, tags=["Models"])
from fastapi.staticfiles import StaticFiles
import os

# Mount the static extension folder if it exists (for local testing)
extension_dir = Path(__file__).resolve().parent.parent / "extension"
if extension_dir.exists():
    app.mount("/extension", StaticFiles(directory=str(extension_dir)), name="extension")
elif os.path.exists("extension"):
    app.mount("/extension", StaticFiles(directory="extension"), name="extension")
else:
    print("[Warning] 'extension' directory not found. Static files for extension not mounted.")

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
