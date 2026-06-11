import json
import re
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.exceptions import OutputParserException
from backend.services.llm_service import get_llm
from backend.core.prompts import (
    JOB_EXTRACTION_PROMPT,
    TONE_GUIDELINES,
    DEFAULT_EMAIL_PROMPT
)
from backend.models.schemas import Job, UserProfile

def extract_jobs(page_content: str, provider: str, api_key: str, model_name: str | None = None) -> list:
    """
    Scrapes jobs from page content text using LLM and returns structured JSON lists.
    """
    llm = get_llm(provider, api_key, temperature=0.0, model_name=model_name)
    prompt = PromptTemplate.from_template(JOB_EXTRACTION_PROMPT)
    
    # Simple truncate to avoid context limit issues
    truncated_content = page_content[:60000]
    
    chain = prompt | llm
    res = chain.invoke(input={"page_data": truncated_content})
    content = res.content.strip()
    
    # Try parsing
    try:
        parser = JsonOutputParser()
        parsed = parser.parse(content)
        return parsed if isinstance(parsed, list) else [parsed]
    except Exception as e:
        # Fallback regex extraction if parser failed
        print(f"[Chains] Standard JSON parser failed: {e}. Trying regex cleanup.")
        try:
            match = re.search(r'\[\s*\{.*\}\s*\]', content, re.DOTALL)
            if match:
                cleaned_content = match.group(0)
                parsed = json.loads(cleaned_content)
                return parsed if isinstance(parsed, list) else [parsed]
        except Exception as inner_e:
            print(f"[Chains] Regex JSON cleanup also failed: {inner_e}")
            
        raise ValueError("AI output was not in valid JSON format. Please try again.")

def generate_email(
    job: Job,
    profile: UserProfile,
    portfolio_links: list[str],
    tone: str,
    instructions: str,
    custom_prompt: str | None,
    provider: str,
    api_key: str,
    model_name: str | None = None
) -> str:
    """
    Generates a personalized cold email using LLM with tone guidelines and portfolio links.
    """
    llm = get_llm(provider, api_key, temperature=0.3, model_name=model_name) # Slightly creative
    
    # Determine which prompt template to use
    template = custom_prompt if custom_prompt else DEFAULT_EMAIL_PROMPT
    if not profile.company or not profile.company.strip():
        template = template.replace(" at {company}", "")
        template = template.replace(" and company ({company})", "")
        template = template.replace(" ({company})", "")
        
    prompt = PromptTemplate.from_template(template)
    
    # Format links
    links_formatted = "\n".join([f"- {link}" for link in portfolio_links]) if portfolio_links else "No links provided."
    
    # Tone guidelines lookup
    guideline = TONE_GUIDELINES.get(tone, TONE_GUIDELINES["professional"])
    
    # Format variables
    variables = {
        "name": profile.name,
        "role": profile.role,
        "company": profile.company,
        "bio": profile.bio,
        "tone": tone,
        "tone_guidelines": guideline,
        "instructions": instructions,
        "portfolio_links": links_formatted,
        "job_role": job.role,
        "job_company": job.company,
        "job_description": job.description,
        "job_skills": ", ".join(job.skills) if job.skills else "Not specified"
    }
    
    chain = prompt | llm
    res = chain.invoke(variables)
    email_text = res.content.strip()
    
    # Strip common preambles returning from LLM
    preamble_prefixes = [
        "subject:", "here is the email:", "cold email:", 
        "dear", "hi", "here's a draft", "here is a cold email"
    ]
    
    lines = email_text.split("\n")
    cleaned_lines = []
    skipped_header = False
    
    for line in lines:
        cleaned_line = line.strip().lower()
        if not skipped_header:
            # Check if line looks like subject line or introduction preamble
            if any(cleaned_line.startswith(prefix) for prefix in preamble_prefixes):
                continue
            if not cleaned_line:
                continue
            skipped_header = True
        cleaned_lines.append(line)
        
    return "\n".join(cleaned_lines).strip()
