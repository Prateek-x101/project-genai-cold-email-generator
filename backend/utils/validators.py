import re
from urllib.parse import urlparse

def is_valid_email(email: str) -> bool:
    """Checks if string matches standard email formatting."""
    if not email:
        return False
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(email_regex, email.strip()))

def is_valid_url(url: str) -> bool:
    """Checks if string has a valid URL structure."""
    if not url:
        return False
    try:
        result = urlparse(url.strip())
        return all([result.scheme, result.netloc])
    except ValueError:
        return False
