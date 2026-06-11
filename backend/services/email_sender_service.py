import base64
import email
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import aiosmtplib
import re

def get_direct_download_url(url: str) -> str:
    url = url.strip()
    
    # 1. Google Drive /file/d/ID/view
    drive_file_match = re.search(r'drive\.google\.com/file/d/([a-zA-Z0-9_-]+)', url)
    if drive_file_match:
        file_id = drive_file_match.group(1)
        return f"https://drive.google.com/uc?export=download&id={file_id}"
        
    # 2. Google Drive open?id=ID
    drive_open_match = re.search(r'drive\.google\.com/open\?.*id=([a-zA-Z0-9_-]+)', url)
    if drive_open_match:
        file_id = drive_open_match.group(1)
        return f"https://drive.google.com/uc?export=download&id={file_id}"
        
    # 3. Google Docs document/d/ID/edit
    doc_match = re.search(r'docs\.google\.com/document/d/([a-zA-Z0-9_-]+)', url)
    if doc_match:
        file_id = doc_match.group(1)
        return f"https://docs.google.com/document/d/{file_id}/export?format=pdf"
        
    # 4. Google Sheets spreadsheets/d/ID/edit
    sheet_match = re.search(r'docs\.google\.com/spreadsheets/d/([a-zA-Z0-9_-]+)', url)
    if sheet_match:
        file_id = sheet_match.group(1)
        return f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=pdf"
        
    # 5. Google Slides presentation/d/ID/edit
    presentation_match = re.search(r'docs\.google\.com/presentation/d/([a-zA-Z0-9_-]+)', url)
    if presentation_match:
        file_id = presentation_match.group(1)
        return f"https://docs.google.com/presentation/d/{file_id}/export?format=pdf"
        
    return url

def should_append_signature(body: str, signature: str) -> bool:
    if not signature or not signature.strip():
        return False
        
    body_clean = body.strip().lower()
    sig_clean = signature.strip().lower()
    
    # 1. If body already contains the signature near the end, don't append it
    if sig_clean in body_clean:
        last_part = body_clean[-len(sig_clean) - 150:]
        if sig_clean in last_part:
            return False
            
    # Split signature and body into lines to search for overlapping lines/names
    body_lines = [l.strip() for l in body_clean.split('\n') if l.strip()]
    if not body_lines:
        return True
        
    last_4_lines = body_lines[-4:]
    last_lines_text = " ".join(last_4_lines)
    
    sig_lines = [l.strip() for l in sig_clean.split('\n') if l.strip()]
    for s_line in sig_lines:
        # Ignore very short lines to avoid matching common whitespace or short characters
        if len(s_line) > 3 and s_line in last_lines_text:
            return False
            
    # Check for general sign-off phrases in the last lines
    sign_off_words = [
        "best regards", "sincerely", "warm regards", "regards", 
        "thanks", "thank you", "best", "respectfully", "yours truly",
        "kind regards", "cheers", "warmly", "talk soon"
    ]
    for word in sign_off_words:
        for line in last_4_lines:
            if line.startswith(word) or line == word:
                return False
                
    return True

async def send_email_via_smtp(
    to_email: str,
    subject: str,
    body: str,
    gmail_address: str,
    gmail_app_password: str,
    attachments: list = [],
    signature: str = ""
) -> dict:
    """
    Sends a cold email via Gmail SMTP using app credentials.
    Supports attachments encoded as Base64 or direct file URLs.
    """
    to_email = to_email.strip()
    gmail_address = gmail_address.strip()
    gmail_app_password = gmail_app_password.strip().replace(" ", "") # App passwords have spaces sometimes
    
    # 1. Construct email message
    msg = MIMEMultipart()
    msg["From"] = gmail_address
    msg["To"] = to_email
    msg["Subject"] = subject
    
    # Append signature if exists and body doesn't already contain it/sign-off
    final_body = body
    if signature and should_append_signature(body, signature):
        final_body += f"\n\n--\n{signature}"
        
    msg.attach(MIMEText(final_body, "plain", "utf-8"))
    
    # 2. Add attachments
    for attach in attachments:
        try:
            # Normalize model/dict to dict
            if hasattr(attach, "model_dump"):
                attach_dict = attach.model_dump()
            elif hasattr(attach, "dict"):
                attach_dict = attach.dict()
            elif isinstance(attach, dict):
                attach_dict = attach
            else:
                attach_dict = {
                    "name": getattr(attach, "name", "attachment"),
                    "base64": getattr(attach, "base64", ""),
                    "url": getattr(attach, "url", None)
                }
                
            name = attach_dict.get("name", "attachment")
            base64_data = attach_dict.get("base64", "")
            url = attach_dict.get("url")
            
            file_data = None
            if base64_data:
                # If base64 contains the data URL header, strip it
                if "," in base64_data:
                    base64_data = base64_data.split(",")[1]
                file_data = base64.b64decode(base64_data)
            elif url:
                # Download from URL
                download_url = get_direct_download_url(url)
                import requests
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                response = requests.get(download_url, headers=headers, timeout=15)
                if response.status_code != 200:
                    raise RuntimeError(f"Failed to download attachment from {url}: HTTP {response.status_code}")
                
                # Check for Google Drive virus scan warning
                content_type = response.headers.get("Content-Type", "")
                if "text/html" in content_type and ("Google Drive" in response.text or "confirm=" in response.url or "sign in" in response.text.lower()):
                    confirm_match = re.search(r'confirm=([a-zA-Z0-9_-]+)', response.text)
                    if confirm_match:
                        confirm_code = confirm_match.group(1)
                        retry_url = f"{download_url}&confirm={confirm_code}"
                        response = requests.get(retry_url, headers=headers, timeout=15)
                        if response.status_code != 200:
                            raise RuntimeError(f"Failed to download from Google Drive after virus confirmation: HTTP {response.status_code}")
                    else:
                        raise RuntimeError(f"Google Drive file at {url} is not publicly accessible. Please check that 'Anyone with the link' access is set, or try uploading it as a file.")
                
                file_data = response.content
                
                # Clean up filename from Content-Disposition if name is generic or doesn't have an extension
                if not name or "." not in name or name.lower() in ["view", "open", "attachment"]:
                    cd = response.headers.get("Content-Disposition", "")
                    if cd and "filename=" in cd:
                        fn_match = re.search(r'filename="?([^";]+)"?', cd)
                        if fn_match:
                            name = fn_match.group(1)
                
                # Check content type and extension
                content_type_lower = content_type.lower()
                if "pdf" in content_type_lower and not name.lower().endswith(".pdf"):
                    base_name = name.split("?")[0].split(".")[0]
                    name = f"{base_name}.pdf"
                elif "png" in content_type_lower and not name.lower().endswith(".png"):
                    base_name = name.split("?")[0].split(".")[0]
                    name = f"{base_name}.png"
                elif "jpeg" in content_type_lower and not name.lower().endswith(".jpg") and not name.lower().endswith(".jpeg"):
                    base_name = name.split("?")[0].split(".")[0]
                    name = f"{base_name}.jpg"
                
                # Force .pdf for Google Doc/Sheet/Slide exports
                if ("docs.google.com/document/d/" in url or 
                    "docs.google.com/spreadsheets/d/" in url or 
                    "docs.google.com/presentation/d/" in url):
                    if not name.lower().endswith(".pdf"):
                        name = name.split("?")[0].split(".")[0] + ".pdf"
            
            if not file_data:
                continue
                
            # Determine mime type
            mime = MIMEBase("application", "octet-stream")
            if name.endswith(".pdf"):
                mime = MIMEBase("application", "pdf")
            elif name.endswith(".png"):
                mime = MIMEBase("image", "png")
            elif name.endswith(".jpg") or name.endswith(".jpeg"):
                mime = MIMEBase("image", "jpeg")
            elif name.endswith(".docx"):
                mime = MIMEBase("application", "vnd.openxmlformats-officedocument.wordprocessingml.document")
                
            mime.set_payload(file_data)
            encoders.encode_base64(mime)
            mime.add_header("Content-Disposition", f"attachment; filename={name}")
            msg.attach(mime)
        except Exception as e:
            err_name = attach_dict.get('name') if isinstance(attach, dict) else getattr(attach, 'name', 'attachment')
            print(f"[SMTP] Error attaching file {err_name}: {e}")
            raise RuntimeError(f"Failed to attach file '{err_name}': {str(e)}")

    # 3. SMTP configuration and transmission
    connected = False
    smtp = None
    
    # Try SSL port 465 first
    try:
        smtp = aiosmtplib.SMTP(
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            timeout=15
        )
        await smtp.connect()
        await smtp.login(gmail_address, gmail_app_password)
        await smtp.send_message(msg)
        await smtp.quit()
        connected = True
    except aiosmtplib.SMTPAuthenticationError:
        raise RuntimeError("Gmail authentication failed. Please double check your Gmail address and 16-character App Password.")
    except Exception as e:
        # Fallback to STARTTLS port 587
        try:
            smtp = aiosmtplib.SMTP(
                hostname="smtp.gmail.com",
                port=587,
                use_tls=False,
                timeout=15
            )
            await smtp.connect()
            await smtp.starttls()
            await smtp.login(gmail_address, gmail_app_password)
            await smtp.send_message(msg)
            await smtp.quit()
            connected = True
        except aiosmtplib.SMTPAuthenticationError:
            raise RuntimeError("Gmail authentication failed. Please double check your Gmail address and 16-character App Password.")
        except Exception as fallback_err:
            raise RuntimeError(
                f"Failed to send email via port 465 and port 587. "
                f"Error 465: {str(e)}. Error 587: {str(fallback_err)}"
            )

    if connected:
        return {"success": True, "message": "Email sent successfully!"}


async def verify_smtp_credentials(
    gmail_address: str,
    gmail_app_password: str
) -> dict:
    """
    Tests Gmail SMTP credentials by connecting and logging in without sending any email.
    Returns {"success": True} on valid credentials or raises RuntimeError with a clear message.
    """
    gmail_address = gmail_address.strip()
    # Strip spaces — Google App Passwords are displayed with spaces but used without
    gmail_app_password = gmail_app_password.strip().replace(" ", "")

    if not gmail_address or not gmail_app_password:
        raise RuntimeError("Gmail address and App Password are required.")

    if len(gmail_app_password) != 16:
        raise RuntimeError(
            f"App Password must be exactly 16 characters (got {len(gmail_app_password)} after removing spaces). "
            "Generate one at myaccount.google.com/apppasswords"
        )

    connected = False
    smtp = None
    
    # Try Port 465 (SSL/TLS) first, then fallback to Port 587 (STARTTLS)
    try:
        smtp = aiosmtplib.SMTP(
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            timeout=15
        )
        await smtp.connect()
        await smtp.login(gmail_address, gmail_app_password)
        await smtp.quit()
        connected = True
    except aiosmtplib.SMTPAuthenticationError:
        raise RuntimeError(
            "Authentication failed. Make sure:\n"
            "1. You entered the correct Gmail address\n"
            "2. You are using a Google App Password (not your regular Gmail password)\n"
            "3. 2-Step Verification is enabled at myaccount.google.com/security\n"
            "Generate App Password: myaccount.google.com/apppasswords"
        )
    except Exception as e:
        # Fallback to Port 587
        try:
            smtp = aiosmtplib.SMTP(
                hostname="smtp.gmail.com",
                port=587,
                use_tls=False,
                timeout=15
            )
            await smtp.connect()
            await smtp.starttls()
            await smtp.login(gmail_address, gmail_app_password)
            await smtp.quit()
            connected = True
        except aiosmtplib.SMTPAuthenticationError:
            raise RuntimeError(
                "Authentication failed. Make sure:\n"
                "1. You entered the correct Gmail address\n"
                "2. You are using a Google App Password (not your regular Gmail password)\n"
                "3. 2-Step Verification is enabled at myaccount.google.com/security\n"
                "Generate App Password: myaccount.google.com/apppasswords"
            )
        except Exception as fallback_err:
            raise RuntimeError(
                f"Failed to connect to Gmail SMTP server on Port 465 and Port 587. "
                f"Error 465: {str(e)}. Error 587: {str(fallback_err)}"
            )

    if connected:
        return {"success": True, "message": "Gmail credentials verified successfully!"}
