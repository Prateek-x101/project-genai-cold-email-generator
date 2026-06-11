import re
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from backend.models.schemas import ContactResult

EMAIL_REGEX = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'

async def find_contacts_service(
    company: str,
    page_url: str = "",
    page_content: str = ""
) -> list[ContactResult]:
    """
    Find emails for a company using multiple strategies.
    Strategy 1: Regex matches on page text
    Strategy 2: Extract domain from page URL and crawl contact pages
    Strategy 3: Guess typical pattern addresses (hr@, careers@, jobs@, recruiting@)
    """
    found_emails = {} # email -> ContactResult

    # Strategy 1: Find emails in page content using regex
    if page_content:
        emails = re.findall(EMAIL_REGEX, page_content)
        for email in emails:
            email_lower = email.strip().lower()
            # Basic validation
            if validate_email_format(email_lower):
                found_emails[email_lower] = ContactResult(
                    email=email_lower,
                    source="page_content",
                    confidence="verified"
                )

    # Resolve company domain for website crawl and guessing
    domain = ""
    if page_url:
        try:
            parsed = urlparse(page_url)
            domain = parsed.netloc.replace("www.", "")
        except Exception:
            pass
            
    if not domain and company:
        # Construct domain from company name
        clean_company = re.sub(r'[^a-zA-Z0-9]', '', company).lower()
        if clean_company:
            domain = f"{clean_company}.com"

    # Strategy 2: Crawl contact pages of the domain if domain was found
    if domain:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        # Paths to search
        paths = ["", "/contact", "/about", "/careers", "/jobs"]
        for path in paths:
            try:
                target_url = f"https://{domain}{path}"
                res = requests.get(target_url, headers=headers, timeout=5)
                if res.ok:
                    soup = BeautifulSoup(res.text, "html.parser")
                    # Clean tags
                    for tag in soup(["script", "style"]):
                        tag.decompose()
                        
                    emails = re.findall(EMAIL_REGEX, soup.get_text())
                    for email in emails:
                        email_lower = email.strip().lower()
                        if validate_email_format(email_lower) and email_lower not in found_emails:
                            found_emails[email_lower] = ContactResult(
                                email=email_lower,
                                source="website_scrape",
                                confidence="suggested"
                            )
            except Exception:
                # Fail silently, move to next crawl path
                pass

    # Strategy 3: Guess typical recruiting patterns for the domain
    if domain:
        patterns = ["hr", "careers", "jobs", "recruiting", "info", "contact"]
        for p in patterns:
            email_guess = f"{p}@{domain}"
            if email_guess not in found_emails:
                found_emails[email_guess] = ContactResult(
                    email=email_guess,
                    source="pattern_guess",
                    confidence="suggested"
                )

    # Convert mapping back to list
    return list(found_emails.values())

def validate_email_format(email: str) -> bool:
    """Helper validator to exclude standard design file extensions and typical invalid matches."""
    if not email:
        return False
    # Avoid extensions or garbage matches
    garbage_extensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js", ".pdf"]
    for ext in garbage_extensions:
        if email.endswith(ext):
            return False
    return True
