import requests
from bs4 import BeautifulSoup
from langchain_community.document_loaders import WebBaseLoader
import re

async def scrape_url(url: str) -> str:
    """
    Scrapes a webpage URL and returns cleaned text.
    Implements a fallback chain: Requests+BS4 -> LangChain WebBaseLoader.
    """
    url = url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise ValueError("Invalid URL scheme. Must start with http:// or https://")

    # Strategy 1: standard requests + bs4 (fastest, lightweight)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=12)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Clean: remove scripts, styles, header, footer, nav
        for element in soup(["script", "style", "nav", "footer", "header", "iframe", "noscript"]):
            element.decompose()
            
        text = soup.get_text(separator=" ")
        cleaned = clean_text_whitespace(text)
        
        if len(cleaned) > 200:
            return cleaned[:100000] # Limit size to 100k chars
            
    except Exception as e:
        print(f"[Scraper] Requests strategy failed for {url}: {e}. Trying WebBaseLoader fallback.")
        
    # Strategy 2: WebBaseLoader fallback
    try:
        loader = WebBaseLoader([url])
        docs = loader.load()
        if docs:
            text = docs[0].page_content
            cleaned = clean_text_whitespace(text)
            return cleaned[:100000]
    except Exception as e:
        print(f"[Scraper] WebBaseLoader also failed for {url}: {e}")
        
    raise RuntimeError("Unable to extract text from the provided URL. The website might be blocking scrapers or requires login.")

def clean_text_whitespace(text: str) -> str:
    """Removes extra white space and trims text."""
    # Replace multiple newlines/spaces with single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()
