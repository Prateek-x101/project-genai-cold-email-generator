from fastapi import APIRouter
from backend.models.schemas import (
    GenerateEmailRequest, GenerateEmailResponse,
    SendEmailRequest, SendEmailResponse,
    VerifySmtpRequest, VerifySmtpResponse
)
from backend.core.chains import generate_email
from backend.services.email_sender_service import send_email_via_smtp, verify_smtp_credentials

router = APIRouter()

@router.post("/generate-email", response_model=GenerateEmailResponse)
async def api_generate_email(request: GenerateEmailRequest):
    """
    Generates a personalized cold outreach email for a job posting.
    """
    try:
        email_body = generate_email(
            job=request.job,
            profile=request.user_profile,
            portfolio_links=request.portfolio_links,
            tone=request.tone,
            instructions=request.custom_instructions,
            custom_prompt=request.custom_prompt,
            provider=request.provider,
            api_key=request.api_key,
            model_name=request.model_name
        )
        
        subject = f"Regarding {request.job.role} opening at {request.job.company}"
        return GenerateEmailResponse(success=True, subject=subject, body=email_body)
    except Exception as e:
        return GenerateEmailResponse(success=False, subject="", body="", error=str(e))

@router.post("/send-email", response_model=SendEmailResponse)
async def api_send_email(request: SendEmailRequest):
    """
    Sends an email using standard Gmail SMTP credentials.
    """
    try:
        res = await send_email_via_smtp(
            to_email=request.to_email,
            subject=request.subject,
            body=request.body,
            gmail_address=request.gmail_address,
            gmail_app_password=request.gmail_app_password,
            attachments=request.attachments,
            signature=request.signature
        )
        return SendEmailResponse(success=True, message=res.get("message", "Email sent!"))
    except Exception as e:
        return SendEmailResponse(success=False, message="", error=str(e))

@router.post("/verify-smtp", response_model=VerifySmtpResponse)
async def api_verify_smtp(request: VerifySmtpRequest):
    """
    Tests Gmail SMTP credentials (connect + login only, no email sent).
    Use this to validate credentials before attempting bulk send.
    """
    try:
        res = await verify_smtp_credentials(
            gmail_address=request.gmail_address,
            gmail_app_password=request.gmail_app_password
        )
        return VerifySmtpResponse(success=True, message=res.get("message", "Credentials verified!"))
    except Exception as e:
        return VerifySmtpResponse(success=False, message="", error=str(e))

