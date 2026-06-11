# ============ LLM PROMPTS ============

# Job Extraction System Prompt
JOB_EXTRACTION_PROMPT = """
You are a career page data extraction expert. Given raw scraped text from a job page or careers section, your goal is to extract ALL active job postings.

For each job posting, extract:
1. role (The title of the job, e.g., "Senior React Developer")
2. company (Name of the employer, e.g., "Nike". Try to extract this or fallback to what is in the document context)
3. experience (Minimum years of experience required, or "Entry Level" / "Not Specified")
4. skills (A clean JSON list of specific tech stack / skills required, e.g., ["React", "CSS", "TypeScript", "Node.js"])
5. description (A concise summary of the job description, around 2-4 sentences max, focus on requirements)

INSTRUCTIONS:
- Return the output strictly as a JSON array of objects.
- Each object MUST contain the keys: "role", "company", "experience", "skills", "description".
- Do not output any conversational text, explanations, or code blocks outside the JSON itself.
- If no jobs are found, return an empty JSON array: []

RAW SCRAPED TEXT:
{page_data}

VALID JSON ARRAY:
"""

# Tone Guidelines Map
TONE_GUIDELINES = {
    "professional": "Formal business language. Respectful, authoritative, and concise. Focus on clear value proposition and professionalism.",
    "friendly": "Warm, conversational, and personable. Keep it engaging and enthusiastic but still respectful and professional.",
    "bold": "Confident, assertive, and high-impact. Stand out by leading with results and strong action verbs. Be direct.",
    "concise": "Keep it under 100 words. Cut all fluff. State one single value proposition and a direct call to action immediately.",
}

# Default Embedded Email Generation Prompt
DEFAULT_EMAIL_PROMPT = """
You are {name}, a {role} at {company}.
Here is some professional context about you:
{bio}

TASK: Write a personalized cold outreach email regarding the following job opening:
Role: {job_role}
Company: {job_company}
Job Description: {job_description}
Required Skills: {job_skills}

TONE GUIDELINES (Write in a {tone} tone):
{tone_guidelines}

ADDITIONAL WRITING INSTRUCTIONS:
{instructions}

PORTFOLIO RELEVANT LINKS:
Include these portfolio/project links naturally in your email body to showcase capability matching their required skills:
{portfolio_links}

RULES:
- Do NOT use generic template placeholders (e.g., "[Insert Name]", "[Date]"). Personalize the email naturally to their company and role.
- Keep the body concise and under 200 words.
- Provide a clear call to action (e.g., suggest a quick call, a reply, or checking a portfolio link).
- Sign off using your name ({name}) and company ({company}).
- Do NOT output a subject line.
- Do NOT write any introduction or preamble like "Here is the email:". Write ONLY the cold email text.
"""

# LLM Email Contact Extraction Prompt
CONTACT_EXTRACTION_PROMPT = """
Given the text snippet scraped from a website page, extract any potential email addresses.
Return them as a JSON list of strings (e.g., ["hr@nike.com", "careers@nike.com"]).
If no email addresses are found, return an empty array: []

Do not return any explanation or other text.

TEXT TO SEARCH:
{page_content}

JSON ARRAY:
"""
