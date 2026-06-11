/**
 * ColdCraft AI — Constants & Defaults
 * 
 * All hardcoded strings, enum values, default configurations,
 * and prompt templates used across the extension.
 */

/* ============ JOB STATUS ENUM ============ */
const JOB_STATUS = {
  SCRAPED: 'scraped',
  EMAIL_FOUND: 'email_found',
  EMAIL_GENERATED: 'email_generated',
  READY: 'ready',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
};

/* ============ EMAIL CONFIDENCE LEVELS ============ */
const EMAIL_CONFIDENCE = {
  VERIFIED: 'verified',   // User-provided or from page content
  SUGGESTED: 'suggested', // Pattern-guessed or scraped from contact page
  MISSING: 'missing',     // Not found at all
};

/* ============ EMAIL SOURCE ============ */
const EMAIL_SOURCE = {
  PAGE_CONTENT: 'page_content',
  WEBSITE_SCRAPE: 'website_scrape',
  PATTERN_GUESS: 'pattern_guess',
  USER_INPUT: 'user_input',
  CSV_IMPORT: 'csv_import',
};

/* ============ TONE PRESETS ============ */
const TONE_OPTIONS = [
  {
    value: 'professional',
    label: '🏢 Professional',
    description: 'Formal business language. Respectful and concise. Focus on value proposition.',
  },
  {
    value: 'friendly',
    label: '😊 Friendly',
    description: 'Warm, conversational tone. Personable but still professional. Show genuine interest.',
  },
  {
    value: 'bold',
    label: '💪 Bold',
    description: 'Confident and assertive. Lead with impact. Strong action words. Stand out.',
  },
  {
    value: 'concise',
    label: '✂️ Concise',
    description: 'Under 100 words. One clear value prop. Direct call to action. Zero fluff.',
  },
];

/* ============ LLM PROVIDERS ============ */
const LLM_PROVIDERS = [
  { value: 'groq', label: 'Groq (Free)', hint: 'Get key at console.groq.com/keys' },
  { value: 'openai', label: 'OpenAI', hint: 'Get key at platform.openai.com/api-keys' },
  { value: 'gemini', label: 'Google Gemini', hint: 'Get key at aistudio.google.com/apikey' },
];

/* ============ JOB SEARCH PROVIDERS ============ */
const SEARCH_PROVIDERS = [
  { value: 'jsearch', label: 'JSearch (LinkedIn/Indeed)', hint: 'Free: 500 requests/month on RapidAPI' },
  { value: 'adzuna', label: 'Adzuna', hint: 'Free: 250 requests/month' },
  { value: 'remoteok', label: 'RemoteOK', hint: 'Free, no key needed (remote jobs only)' },
];

/* ============ DELAY OPTIONS ============ */
const DELAY_OPTIONS = [
  { value: 5, label: '5 seconds' },
  { value: 10, label: '10 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '60 seconds' },
];

/* ============ DEFAULT EMBEDDED PROMPT ============ */
const DEFAULT_SYSTEM_PROMPT = `You are {name}, a {role} at {company}.

{bio}

TASK: Write a {tone} cold email regarding the following job opening.
The email should pitch your capabilities and how you (or your company) can fulfill their needs.

TONE GUIDELINES:
{tone_guidelines}

ADDITIONAL INSTRUCTIONS:
{instructions}

Include these relevant portfolio/project links naturally in the email body:
{portfolio_links}

JOB DETAILS:
{job_description}

RULES:
- No generic templates — personalize to the specific company and role mentioned in the job
- Keep under 200 words
- Include a clear call to action (suggest a meeting, call, or reply)
- Sign off as {name}
- Do not include a subject line
- Do not include any preamble like "Here is the email:"
- Write the email directly, nothing else`;

/* ============ CSV TEMPLATE COLUMNS ============ */
const CSV_TEMPLATE_HEADERS = [
  'Name',
  'Company',
  'Role',
  'Email',
  'Career Page URL',
  'Job Description',
  'Attachments',
  'Link',
  'Cold Email',
];

const CSV_TEMPLATE_EXAMPLE_ROW = [
  'John Smith',
  'Nike',
  'HR Manager',
  'hr@nike.com',
  'https://jobs.nike.com/job/R-33460',
  'Looking for a Senior React Developer with 5+ years experience...',
  'resume.pdf',
  'https://github.com/my-username, https://my-portfolio.dev',
  '',
];

/* ============ MESSAGE TYPES (Service Worker ↔ UI) ============ */
const MSG = {
  // Scraping
  SCRAPE_ACTIVE_PAGE: 'SCRAPE_ACTIVE_PAGE',
  SCRAPE_URL: 'SCRAPE_URL',
  SCRAPE_URLS_BATCH: 'SCRAPE_URLS_BATCH',
  SCRAPE_RESULT: 'SCRAPE_RESULT',

  // Job Extraction
  EXTRACT_JOBS: 'EXTRACT_JOBS',
  EXTRACT_JOBS_RESULT: 'EXTRACT_JOBS_RESULT',

  // Email Generation
  GENERATE_EMAIL: 'GENERATE_EMAIL',
  GENERATE_EMAIL_RESULT: 'GENERATE_EMAIL_RESULT',
  GENERATE_ALL_EMAILS: 'GENERATE_ALL_EMAILS',

  // Email Sending
  SEND_EMAIL: 'SEND_EMAIL',
  SEND_EMAIL_RESULT: 'SEND_EMAIL_RESULT',
  SEND_ALL: 'SEND_ALL',
  SEND_ALL_PROGRESS: 'SEND_ALL_PROGRESS',

  // Contact Discovery
  FIND_CONTACTS: 'FIND_CONTACTS',
  FIND_CONTACTS_RESULT: 'FIND_CONTACTS_RESULT',

  // Job Search
  SEARCH_JOBS: 'SEARCH_JOBS',
  SEARCH_JOBS_RESULT: 'SEARCH_JOBS_RESULT',

  // Portfolio
  LOAD_PORTFOLIO: 'LOAD_PORTFOLIO',
  QUERY_PORTFOLIO: 'QUERY_PORTFOLIO',

  // Health
  CHECK_HEALTH: 'CHECK_HEALTH',
  HEALTH_RESULT: 'HEALTH_RESULT',

  // Import/Export
  IMPORT_CSV: 'IMPORT_CSV',
  EXPORT_CSV: 'EXPORT_CSV',

  // Content Script
  GET_PAGE_CONTENT: 'GET_PAGE_CONTENT',
  PAGE_CONTENT_RESULT: 'PAGE_CONTENT_RESULT',

  // State sync
  STATE_UPDATED: 'STATE_UPDATED',
};

/* ============ ERROR MESSAGES ============ */
const ERROR_MESSAGES = {
  BACKEND_OFFLINE: '⚡ Server is waking up... try again in 30 seconds.',
  INVALID_API_KEY: '🔑 API key is invalid. Check your settings.',
  LLM_TIMEOUT: '⏱ AI is taking too long. Retrying...',
  LLM_RATE_LIMIT: '🚦 Rate limit reached. Wait 60 seconds.',
  GMAIL_AUTH_FAILED: '📧 Gmail login failed. Check your app password.',
  EMAIL_SEND_FAILED: '❌ Failed to send email.',
  INVALID_CSV: '📋 Invalid file. Make sure it\'s a valid CSV.',
  PAGE_SCRAPE_FAILED: '🌐 Couldn\'t read this page. It might require login.',
  NO_JOBS_FOUND: '🔍 No job listings found on this page.',
  STORAGE_FULL: '💾 Storage is full. Delete some old data.',
  NETWORK_ERROR: '🌐 Network error. Check your connection.',
  MISSING_SETTINGS: '⚙️ Missing settings. Please configure your profile and API key.',
};

/* ============ API ENDPOINTS ============ */
const API_PATHS = {
  HEALTH: '/api/health',
  EXTRACT_JOBS: '/api/extract-jobs',
  GENERATE_EMAIL: '/api/generate-email',
  SEND_EMAIL: '/api/send-email',
  FIND_CONTACTS: '/api/find-contacts',
  SEARCH_JOBS: '/api/search-jobs',
  SCRAPE_URL: '/api/scrape-url',
  PORTFOLIO_LOAD: '/api/portfolio/load',
  PORTFOLIO_QUERY: '/api/portfolio/query',
  MODELS: '/api/models',
};

/* ============ VALIDATION HELPERS ============ */
const VALIDATORS = {
  email: (email) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  url: (url) => {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  apiKey: (key) => {
    return typeof key === 'string' && key.trim().length > 10;
  },
};

/* ============ FILE SIZE LIMITS ============ */
const FILE_LIMITS = {
  RESUME_MAX_BYTES: 5 * 1024 * 1024,      // 5MB
  ATTACHMENT_MAX_BYTES: 5 * 1024 * 1024,   // 5MB
  PAGE_CONTENT_MAX_CHARS: 100000,          // 100K characters
  MAX_JOBS_PER_SESSION: 200,
};

// Export for extension pages
if (typeof window !== 'undefined') {
  window.JOB_STATUS = JOB_STATUS;
  window.EMAIL_CONFIDENCE = EMAIL_CONFIDENCE;
  window.EMAIL_SOURCE = EMAIL_SOURCE;
  window.TONE_OPTIONS = TONE_OPTIONS;
  window.LLM_PROVIDERS = LLM_PROVIDERS;
  window.SEARCH_PROVIDERS = SEARCH_PROVIDERS;
  window.DELAY_OPTIONS = DELAY_OPTIONS;
  window.DEFAULT_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT;
  window.CSV_TEMPLATE_HEADERS = CSV_TEMPLATE_HEADERS;
  window.CSV_TEMPLATE_EXAMPLE_ROW = CSV_TEMPLATE_EXAMPLE_ROW;
  window.MSG = MSG;
  window.ERROR_MESSAGES = ERROR_MESSAGES;
  window.API_PATHS = API_PATHS;
  window.VALIDATORS = VALIDATORS;
  window.FILE_LIMITS = FILE_LIMITS;
} else if (typeof self !== 'undefined') {
  self.JOB_STATUS = JOB_STATUS;
  self.EMAIL_CONFIDENCE = EMAIL_CONFIDENCE;
  self.EMAIL_SOURCE = EMAIL_SOURCE;
  self.TONE_OPTIONS = TONE_OPTIONS;
  self.LLM_PROVIDERS = LLM_PROVIDERS;
  self.SEARCH_PROVIDERS = SEARCH_PROVIDERS;
  self.DELAY_OPTIONS = DELAY_OPTIONS;
  self.DEFAULT_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT;
  self.CSV_TEMPLATE_HEADERS = CSV_TEMPLATE_HEADERS;
  self.CSV_TEMPLATE_EXAMPLE_ROW = CSV_TEMPLATE_EXAMPLE_ROW;
  self.MSG = MSG;
  self.ERROR_MESSAGES = ERROR_MESSAGES;
  self.API_PATHS = API_PATHS;
  self.VALIDATORS = VALIDATORS;
  self.FILE_LIMITS = FILE_LIMITS;
}
