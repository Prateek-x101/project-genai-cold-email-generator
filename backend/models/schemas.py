from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal

# ============ SHARED ABSTRACTIONS ============

class UserProfile(BaseModel):
    name: str = ""
    company: str = ""
    role: str = ""
    bio: str = ""
    skills: str = ""

class Attachment(BaseModel):
    name: str
    base64: Optional[str] = ""  # Data URL or base64 string
    url: Optional[str] = None

class Job(BaseModel):
    id: Optional[str] = None
    role: str = ""
    company: str = ""
    experience: str = ""
    skills: List[str] = []
    description: str = ""
    source_url: str = ""

class ContactResult(BaseModel):
    email: str
    source: Literal["page_content", "website_scrape", "pattern_guess", "domain_extract", "csv_import"]
    confidence: Literal["verified", "suggested", "missing"]

class PortfolioItem(BaseModel):
    techstack: str
    links: str

# ============ REQUEST / RESPONSE MODELS ============

# Job Extraction
class ExtractJobsRequest(BaseModel):
    page_content: str
    page_url: str = ""
    provider: Literal["groq", "openai", "gemini"] = "groq"
    api_key: str
    model_name: Optional[str] = None

class ExtractJobsResponse(BaseModel):
    success: bool
    jobs: List[Job]
    error: Optional[str] = None

# Email Generation
class GenerateEmailRequest(BaseModel):
    job: Job
    user_profile: UserProfile
    portfolio_links: List[str] = []
    tone: Literal["professional", "friendly", "bold", "concise"] = "professional"
    custom_instructions: str = ""
    custom_prompt: Optional[str] = None
    provider: Literal["groq", "openai", "gemini"] = "groq"
    api_key: str
    model_name: Optional[str] = None

class GenerateEmailResponse(BaseModel):
    success: bool
    subject: str
    body: str
    error: Optional[str] = None

# Email Sending
class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    gmail_address: str
    gmail_app_password: str
    attachments: List[Attachment] = []
    signature: str = ""

class SendEmailResponse(BaseModel):
    success: bool
    message: str
    error: Optional[str] = None

# Contact Search
class FindContactsRequest(BaseModel):
    company: str
    page_url: str = ""
    page_content: str = ""

class FindContactsResponse(BaseModel):
    success: bool
    contacts: List[ContactResult]
    error: Optional[str] = None

# Job Search
class SearchJobsRequest(BaseModel):
    query: str
    location: str = ""
    provider: Literal["jsearch", "adzuna", "remoteok"] = "remoteok"
    api_key: Optional[str] = ""
    page: int = 1

class SearchJobsResponse(BaseModel):
    success: bool
    jobs: List[Job]
    error: Optional[str] = None

# Portfolio DB Loading & Querying
class LoadPortfolioRequest(BaseModel):
    items: List[PortfolioItem]

class LoadPortfolioResponse(BaseModel):
    success: bool
    message: str
    error: Optional[str] = None

class QueryPortfolioRequest(BaseModel):
    skills: List[str]
    n_results: int = 2

class QueryPortfolioResponse(BaseModel):
    success: bool
    links: List[str]
    error: Optional[str] = None

# Model Fetching
class FetchModelsRequest(BaseModel):
    provider: str
    api_key: str

class FetchModelsResponse(BaseModel):
    success: bool
    models: List[str]
    error: Optional[str] = None

# SMTP Credential Verification
class VerifySmtpRequest(BaseModel):
    gmail_address: str
    gmail_app_password: str

class VerifySmtpResponse(BaseModel):
    success: bool
    message: str
    error: Optional[str] = None

