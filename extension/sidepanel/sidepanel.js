/**
 * ColdCraft AI — Side Panel JavaScript
 * 
 * Handles all UI interactions, tab switching, job rendering,
 * modal management, toasts, and local state.
 * Backend API calls are wired in Module 3.
 */

// ============ DOM REFERENCES ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Tabs
const tabBtns = $$('.tab-btn');
const tabPanes = $$('.tab-pane');

// Dashboard
const greetingName = $('.greeting-name');
const statSent = $('#stat-sent');
const statPending = $('#stat-pending');
const statTotal = $('#stat-total');

// Modes
const modeExtract = $('#mode-extract');
const modeUrl = $('#mode-url');
const urlInputContainer = $('#url-input-container');
const urlInput = $('#url-input');
const btnExtractUrls = $('#btn-extract-urls');
const modeSearch = $('#mode-search');
const modeImport = $('#mode-import');
const csvFileInput = $('#csv-file-input');
const modeTemplate = $('#mode-template');

// Jobs Tab
const jobsCount = $('#jobs-count');
const jobsFilter = $('#jobs-filter');
const selectAllCheckbox = $('#select-all-checkbox');
const jobList = $('#job-list');
const jobsEmptyState = $('#jobs-empty-state');
const btnGoDashboard = $('#btn-go-dashboard');
const btnGenerateSelected = $('#btn-generate-selected');
const importAnalysis = $('#import-analysis');

// Search
const searchInput = $('#search-input');
const searchProvider = $('#search-provider');
const btnSearch = $('#btn-search');
const searchResults = $('#search-results');

// Side Panel Settings Controls
const settingsDOM = {
  saveAllBtn: $('#qs-save-all-btn'),
  
  // Profile
  profileName: $('#profile-name'),
  profileRole: $('#profile-role'),
  profileCompany: $('#profile-company'),
  profileSkills: $('#profile-skills'),
  profileBio: $('#profile-bio'),

  // AI & Backend
  backendUrl: $('#backend-url'),
  llmProvider: $('#api-llm-provider'),
  llmKey: $('#api-llm-key'),
  llmKeyHint: $('#llm-key-hint'),
  llmModel: $('#api-llm-model'),
  fetchModelsBtn: $('#fetch-models-btn'),
  searchProvider: $('#api-search-provider'),
  searchKey: $('#api-search-key'),
  searchKeyHint: $('#search-key-hint'),
  testConnBtn: $('#test-connection-btn'),

  // Email
  emailAddress: $('#email-address'),
  emailPassword: $('#email-password'),
  emailSignature: $('#email-signature'),
  verifyGmailBtn: $('#verify-gmail-btn'),
  gmailAuthStatus: $('#gmail-auth-status'),
  gmailAuthDetail: $('#gmail-auth-detail'),

  // Attachments
  resumeDropzone: $('#resume-dropzone'),
  resumeInput: $('#resume-input'),
  resumeStatus: $('#resume-status'),
  resumeNameDisplay: $('#resume-name-display'),
  removeResumeBtn: $('#remove-resume-btn'),
  portfolioContainer: $('#portfolio-links-container'),
  addPortfolioBtn: $('#add-portfolio-btn'),

  // Tone & instructions
  promptTone: $('#prompt-tone'),
  promptInstructions: $('#prompt-instructions'),

  // System backups & reset
  exportSettingsBtn: $('#export-settings-btn'),
  importTriggerBtn: $('#import-trigger-btn'),
  importSettingsInput: $('#import-settings-input'),
  resetAllBtn: $('#reset-all-btn'),
};

// Footer
const toggleAutosend = $('#toggle-autosend');
const autosendStatus = $('#autosend-status');
const btnSendAll = $('#btn-send-all');
const sendCount = $('#send-count');

// Header
const btnExport = $('#btn-export');
const btnSettings = $('#btn-settings');

// Preview Modal
const previewModal = $('#preview-modal');
const previewModalTitle = $('#preview-modal-title');
const previewTo = $('#preview-to');
const previewSubject = $('#preview-subject');
const previewBody = $('#preview-body');
const previewAttachments = $('#preview-attachments');
const previewAttachmentsSection = $('#preview-attachments-section');
const previewCloseBtn = $('#preview-close-btn');
const previewEditBtn = $('#preview-edit-btn');
const previewCopyBtn = $('#preview-copy-btn');
const previewGmailBtn = $('#preview-gmail-btn');
const previewSendBtn = $('#preview-send-btn');

// Edit Modal
const editModal = $('#edit-modal');
const editModalTitle = $('#edit-modal-title');
const editEmail = $('#edit-email');
const editSubject = $('#edit-subject');
const editColdEmail = $('#edit-cold-email');
const editResumeChip = $('#edit-resume-chip');
const editResumeInput = $('#edit-resume-input');
const editResumeChange = $('#edit-resume-change');
const editPortfolioLinks = $('#edit-portfolio-links');
const editNewLink = $('#edit-new-link');
const editAddLink = $('#edit-add-link');
const editCancelBtn = $('#edit-cancel-btn');
const editRegenerateBtn = $('#edit-regenerate-btn');
const editSaveBtn = $('#edit-save-btn');

// Confirm Modal
const confirmModal = $('#confirm-modal');
const confirmTitle = $('#confirm-title');
const confirmMessage = $('#confirm-message');
const confirmCancel = $('#confirm-cancel');
const confirmOk = $('#confirm-ok');

// Toast & Loading
const toastContainer = $('#toast-container');
const loadingOverlay = $('#loading-overlay');
const loadingText = $('#loading-text');

// ============ STATE ============
let currentEditJobId = null;
let currentPreviewJobId = null;
let editOverrides = { resume: null, portfolioLinks: null };
let confirmCallback = null;
let sidepanelAttachmentsState = { resumeBase64: '', resumeName: '', portfolioLinks: [] };

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Load settings into integrated sidepanel tab
  await loadSidepanelSettings();

  // Load automation settings
  await loadAutomationState();

  // Update greeting
  await updateGreeting();

  // Restore job history from storage before subscribing to avoid save loop
  try {
    const history = await Storage.get(STORAGE_KEYS.JOB_HISTORY);
    if (history) {
      JobState.deserialize(history);
    }
  } catch (e) {
    console.error('[SidePanel] Failed to restore job history:', e);
  }

  // Subscribe to state changes
  JobState.subscribe(onStateChange);

  // Bind event listeners
  bindTabNavigation();
  bindModeCards();
  bindJobsTab();
  bindSearchTab();
  bindSidepanelSettings();
  bindFooter();
  bindHeader();
  bindModals();

  // Update stats
  updateStats();
  updateSendButton();
}

// ============ TAB NAVIGATION ============
function bindTabNavigation() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  // Update buttons
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Update panes
  tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  // Refresh content when switching to jobs tab
  if (tabId === 'jobs') {
    renderJobList();
  }
}

// ============ GREETING ============
async function updateGreeting() {
  try {
    const profile = await Storage.get(STORAGE_KEYS.PROFILE);
    if (profile.name) {
      greetingName.textContent = `👋 Hey, ${profile.name}!`;
    }
  } catch (e) {
    // Default greeting stays
  }
}

// ============ STATS ============
function updateStats() {
  const stats = JobState.getStats();
  statSent.textContent = stats.sent;
  statPending.textContent = stats.pending;
  statTotal.textContent = stats.total;
}

// ============ MODE CARDS ============
function bindModeCards() {
  // Extract This Page
  modeExtract.addEventListener('click', handleExtractPage);

  // Paste URLs — toggle input
  modeUrl.addEventListener('click', () => {
    urlInputContainer.classList.toggle('hidden');
    if (!urlInputContainer.classList.contains('hidden')) {
      urlInput.focus();
    }
  });

  // Extract URLs button
  btnExtractUrls.addEventListener('click', handleExtractUrls);

  // Search — switch to search tab
  modeSearch.addEventListener('click', () => {
    switchTab('search');
    searchInput.focus();
  });

  // Import CSV
  modeImport.addEventListener('click', () => csvFileInput.click());
  csvFileInput.addEventListener('change', handleCSVImport);

  // Download Template
  modeTemplate.addEventListener('click', downloadCSVTemplate);
}

async function handleExtractPage() {
  showLoading('Scraping page...');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'SCRAPE_ACTIVE_PAGE' });

    if (response.success) {
      showLoading('Extracting jobs from content...');
      const extractResponse = await chrome.runtime.sendMessage({
        type: 'EXTRACT_JOBS',
        pageContent: response.data.text,
        pageUrl: response.data.url
      });

      if (extractResponse.success && extractResponse.jobs) {
        const jobs = extractResponse.jobs;
        if (jobs && jobs.length > 0) {
          const jobsToAdd = [];
          showLoading('Generating cold emails...');
          for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            
            job.id = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            job.scrapedAt = new Date().toISOString();
            job.status = 'scraped';
            job.email = '';
            job.emailSource = 'none';
            job.emailConfidence = 'missing';
            job.coldEmail = '';
            job.coldEmailGenerated = false;

            try {
              showLoading(`Generating email ${i + 1}/${jobs.length} for ${job.role}...`);
              const genRes = await chrome.runtime.sendMessage({
                type: 'GENERATE_EMAIL',
                job: job,
                tone: settingsDOM.promptTone.value,
                instructions: settingsDOM.promptInstructions.value.trim()
              });
              if (genRes && genRes.success) {
                job.coldEmail = genRes.body;
                job.emailSubject = genRes.subject;
                job.coldEmailGenerated = true;
              }
            } catch (err) {
              console.error('Auto email generation failed:', err);
            }

            jobsToAdd.push(job);
          }
          JobState.addJobs(jobsToAdd);
          showToast(`Successfully extracted & generated emails for ${jobs.length} jobs!`, 'success');
        } else {
          showToast('No job postings found on this page.', 'warning');
        }
        switchTab('jobs');
      } else {
        showToast(extractResponse.error || 'Failed to extract jobs.', 'error');
      }
    } else {
      showToast(response.error || ERROR_MESSAGES.PAGE_SCRAPE_FAILED, 'error');
    }
  } catch (error) {
    showToast(ERROR_MESSAGES.PAGE_SCRAPE_FAILED, 'error');
  } finally {
    hideLoading();
  }
}

async function handleExtractUrls() {
  const urls = urlInput.value.trim().split('\n').filter(u => u.trim());

  if (urls.length === 0) {
    showToast('Please paste at least one URL.', 'warning');
    return;
  }

  // Validate URLs
  const invalidUrls = urls.filter(u => !VALIDATORS.url(u.trim()));
  if (invalidUrls.length > 0) {
    showToast(`Invalid URL(s): ${invalidUrls.join(', ')}`, 'error');
    return;
  }

  showLoading(`Scraping & extracting ${urls.length} URL(s)...`);

  try {
    let totalExtracted = 0;
    const allJobsToAdd = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      showLoading(`Scraping ${i + 1}/${urls.length}: ${url}...`);

      // Fetch webpage html bypassing CORS via extension context
      const res = await fetch(url);
      const html = await res.text();

      // Clean HTML
      const cleanText = html
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      showLoading(`Extracting jobs ${i + 1}/${urls.length}...`);
      const extractResponse = await chrome.runtime.sendMessage({
        type: 'EXTRACT_JOBS',
        pageContent: cleanText,
        pageUrl: url
      });

      if (extractResponse.success && extractResponse.jobs) {
        for (let j = 0; j < extractResponse.jobs.length; j++) {
          const job = extractResponse.jobs[j];
          job.id = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          job.scrapedAt = new Date().toISOString();
          job.status = 'scraped';
          job.email = '';
          job.emailSource = 'none';
          job.emailConfidence = 'missing';
          job.coldEmail = '';
          job.coldEmailGenerated = false;

          try {
            showLoading(`Generating email for ${job.role}...`);
            const genRes = await chrome.runtime.sendMessage({
              type: 'GENERATE_EMAIL',
              job: job,
              tone: settingsDOM.promptTone.value,
              instructions: settingsDOM.promptInstructions.value.trim()
            });
            if (genRes && genRes.success) {
              job.coldEmail = genRes.body;
              job.emailSubject = genRes.subject;
              job.coldEmailGenerated = true;
            }
          } catch (err) {
            console.error('Auto email generation failed:', err);
          }

          allJobsToAdd.push(job);
        }
        totalExtracted += extractResponse.jobs.length;
      }
    }

    if (allJobsToAdd.length > 0) {
      JobState.addJobs(allJobsToAdd);
    }

    showToast(`Finished! Extracted ${totalExtracted} jobs from ${urls.length} links.`, 'success');
    urlInputContainer.classList.add('hidden');
    urlInput.value = '';
    switchTab('jobs');
  } catch (err) {
    showToast('Failed to scrape pasted URLs: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

function downloadCSVTemplate() {
  const csv = [
    CSV_TEMPLATE_HEADERS.map(h => `"${h}"`).join(','),
    CSV_TEMPLATE_EXAMPLE_ROW.map(v => `"${v}"`).join(','),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'coldcraft-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);

  showToast('Template downloaded! Fill it and import it back.', 'success');
}

function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.name.endsWith('.csv')) {
    showToast(ERROR_MESSAGES.INVALID_CSV, 'error');
    csvFileInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csvText = e.target.result;
      const jobs = parseCSV(csvText);

      if (jobs.length === 0) {
        showToast('No valid rows found in CSV.', 'warning');
        return;
      }

      // Add jobs to state
      const addedJobs = JobState.addJobs(jobs);

      // Show analysis
      showImportAnalysis(addedJobs);

      // Switch to jobs tab
      switchTab('jobs');

      showToast(`Imported ${addedJobs.length} entries from CSV.`, 'success');
    } catch (error) {
      showToast('Failed to parse CSV: ' + error.message, 'error');
    }
  };

  reader.onerror = () => {
    showToast('Failed to read file.', 'error');
  };

  reader.readAsText(file);
  csvFileInput.value = ''; // Reset for re-import
}

// ============ CSV PARSER ============
function parseCSV(text) {
  // Handle BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return []; // Need header + at least 1 row

  // Parse header — fuzzy match column names
  const rawHeaders = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const colMap = {
    name: findColumn(rawHeaders, ['name', 'contact', 'person']),
    company: findColumn(rawHeaders, ['company', 'organization', 'org', 'employer']),
    role: findColumn(rawHeaders, ['role', 'title', 'position', 'job title']),
    email: findColumn(rawHeaders, ['email', 'e-mail', 'mail', 'email address']),
    url: findColumn(rawHeaders, ['source url', 'url', 'career page url', 'career url', 'career page', 'job url']), // Removed 'link' to avoid conflict
    description: findColumn(rawHeaders, ['description', 'job description', 'desc', 'jd']),
    coldEmail: findColumn(rawHeaders, ['cold email', 'cold_email', 'email body', 'email text', 'message']),
  };

  // Find all header indices that match attachments
  const attachmentIndices = [];
  rawHeaders.forEach((header, index) => {
    if (header.includes('attachment') || header.includes('resume')) {
      attachmentIndices.push({ index, header });
    }
  });
  // Sort them so primary/main attachments are first
  attachmentIndices.sort((a, b) => {
    const isMainA = a.header === 'attachments' || a.header === 'attachment' || a.header === 'resume';
    const isMainB = b.header === 'attachments' || b.header === 'attachment' || b.header === 'resume';
    if (isMainA && !isMainB) return -1;
    if (!isMainA && isMainB) return 1;
    return a.index - b.index;
  });

  const linkIndex = findColumn(rawHeaders, ['link', 'links', 'portfolio']);

  const parseAttachmentValue = (val) => {
    if (!val) return null;
    val = val.trim();
    if (val.includes(';base64,')) {
      const parts = val.split(';');
      const name = parts[0];
      const base64 = parts.slice(1).join(';');
      return { name, base64 };
    }
    if (val.startsWith('data:')) {
      return { name: 'attachment.bin', base64: val };
    }
    if (val.startsWith('http://') || val.startsWith('https://') || val.includes('drive.google.com') || val.includes('docs.google.com') || val.startsWith('www.')) {
      let url = val;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      const urlParts = url.split('?')[0].split('/');
      const name = urlParts[urlParts.length - 1] || 'attachment';
      return { name, base64: '', url: url };
    }
    return { name: val, base64: '' };
  };

  const jobs = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const getValue = (key) => (colMap[key] !== -1 && colMap[key] < values.length ? (values[colMap[key]] || '').trim() : '');

    const company = getValue('company');
    const role = getValue('role');
    const email = getValue('email');
    const url = getValue('url');
    const description = getValue('description');
    const coldEmail = getValue('coldEmail');

    // Skip if nothing useful
    if (!company && !role && !email && !url && !description) continue;

    const hasEmail = VALIDATORS.email(email);
    const hasColdEmail = coldEmail.length > 20;

    // Attachments parsing
    let overrideResume = null;
    const overrideAttachments = [];
    attachmentIndices.forEach((item, idx) => {
      if (item.index < values.length) {
        const val = (values[item.index] || '').trim();
        if (val) {
          const parsed = parseAttachmentValue(val);
          if (parsed) {
            if (idx === 0) {
              overrideResume = parsed;
            } else {
              overrideAttachments.push(parsed);
            }
          }
        }
      }
    });

    // Links parsing (portfolio links)
    let overridePortfolio = null;
    if (linkIndex !== -1 && linkIndex < values.length) {
      const val = (values[linkIndex] || '').trim();
      if (val) {
        overridePortfolio = val.split(/[,\s]+/)
          .map(l => l.trim())
          .filter(l => l.length > 0);
      }
    }

    jobs.push({
      role: role || 'Unknown Role',
      company: company || 'Unknown Company',
      email: hasEmail ? email : '',
      emailSource: hasEmail ? 'csv_import' : 'none',
      emailConfidence: hasEmail ? 'verified' : 'missing',
      sourceUrl: url,
      description: description,
      coldEmail: hasColdEmail ? coldEmail : '',
      coldEmailGenerated: hasColdEmail,
      overrideResume: overrideResume,
      overridePortfolio: overridePortfolio,
      overrideAttachments: overrideAttachments.length > 0 ? overrideAttachments : null
    });
  }

  return jobs;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function findColumn(headers, aliases) {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  // Fuzzy: check if any header contains the alias
  for (const alias of aliases) {
    const idx = headers.findIndex(h => h.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ============ IMPORT ANALYSIS ============
function showImportAnalysis(jobs) {
  let ready = 0, needsGen = 0, needsEmail = 0, manual = 0, incomplete = 0;

  for (const job of jobs) {
    if (job.email && job.coldEmailGenerated) ready++;
    else if (job.email && !job.coldEmailGenerated) needsGen++;
    else if (job.sourceUrl || job.description) needsEmail++;
    else if (job.company) manual++;
    else incomplete++;
  }

  importAnalysis.querySelector('#analysis-ready .analysis-count').textContent = ready;
  importAnalysis.querySelector('#analysis-needs-gen .analysis-count').textContent = needsGen;
  importAnalysis.querySelector('#analysis-needs-email .analysis-count').textContent = needsEmail;
  importAnalysis.querySelector('#analysis-manual .analysis-count').textContent = manual;
  importAnalysis.querySelector('#analysis-incomplete .analysis-count').textContent = incomplete;

  importAnalysis.classList.remove('hidden');
  jobsEmptyState.classList.add('hidden');
}

// ============ JOBS TAB ============
function bindJobsTab() {
  // Filter
  jobsFilter.addEventListener('change', () => {
    JobState.setFilter(jobsFilter.value);
  });

  // Select All
  selectAllCheckbox.addEventListener('click', () => {
    const isChecked = selectAllCheckbox.classList.contains('checked');
    if (isChecked) {
      JobState.deselectAll();
    } else {
      JobState.selectAll();
    }
  });

  // Go to Dashboard button (in empty state)
  btnGoDashboard.addEventListener('click', () => switchTab('dashboard'));

  // Generate selected
  btnGenerateSelected.addEventListener('click', handleGenerateSelected);

  // Import analysis buttons
  $('#btn-process-import')?.addEventListener('click', handleProcessImport);
  $('#btn-dismiss-analysis')?.addEventListener('click', () => {
    importAnalysis.classList.add('hidden');
  });
}

function renderJobList() {
  const jobs = JobState.getJobs(true);
  const selected = JobState.getSelected();

  // Update count
  jobsCount.textContent = jobs.length;

  // Show/hide empty state
  if (jobs.length === 0 && importAnalysis.classList.contains('hidden')) {
    jobsEmptyState.classList.remove('hidden');
  } else {
    jobsEmptyState.classList.add('hidden');
  }

  // Clear existing cards
  jobList.innerHTML = '';

  // Render cards
  jobs.forEach((job, index) => {
    const card = createJobCard(job, selected.has(job.id));
    card.classList.add('anim-item');
    card.style.animationDelay = `${index * 0.03}s`;
    jobList.appendChild(card);
  });

  // Update select all checkbox
  const allSelected = jobs.length > 0 && jobs.every(j => selected.has(j.id));
  selectAllCheckbox.classList.toggle('checked', allSelected);
  selectAllCheckbox.innerHTML = allSelected ? '✓' : '&nbsp;';

  updateSendButton();
}

function createJobCard(job, isSelected) {
  const card = document.createElement('div');
  card.className = 'job-card pixel-card';
  card.dataset.jobId = job.id;

  const statusBadge = getStatusBadge(job.status);
  const emailRow = getEmailRow(job);
  const actionBtns = getActionButtons(job);

  card.innerHTML = `
    <div class="job-card-header">
      <div class="job-card-left">
        <div class="checkbox ${isSelected ? 'checked' : ''}" data-action="select" data-id="${job.id}">
          ${isSelected ? '✓' : '&nbsp;'}
        </div>
        <div>
          <div class="job-title">${escapeHtml(job.role)}</div>
          <div class="job-company">${escapeHtml(job.company)}</div>
        </div>
      </div>
      ${statusBadge}
    </div>
    ${emailRow}
    <div class="job-actions">${actionBtns}</div>
  `;

  // Bind checkbox click
  card.querySelector('[data-action="select"]').addEventListener('click', () => {
    JobState.toggleSelect(job.id);
  });

  // Bind action buttons
  bindJobCardActions(card, job);

  return card;
}

function getStatusBadge(status) {
  const badges = {
    scraped: '<span class="status-badge pending">⏳ Scraped</span>',
    email_found: '<span class="status-badge pending">📬 Email Found</span>',
    email_generated: '<span class="status-badge pending">📧 Generated</span>',
    ready: '<span class="status-badge ready">✅ Ready</span>',
    sending: '<span class="status-badge sending">⏳ Sending...</span>',
    sent: '<span class="status-badge sent">✅ Sent</span>',
    failed: '<span class="status-badge error">❌ Failed</span>',
  };
  return badges[status] || badges.scraped;
}

function getEmailRow(job) {
  if (job.emailConfidence === 'missing' || !job.email) {
    return `
      <div class="job-email-row">
        <input class="form-input job-email-input" data-action="set-email" data-id="${job.id}"
               placeholder="Enter email address..." value="">
      </div>
    `;
  }

  const confidenceBadge = job.emailConfidence === 'verified'
    ? '<span class="email-confidence verified">✓ Verified</span>'
    : '<span class="email-confidence suggested">⚠ Suggested</span>';

  return `
    <div class="job-email-row">
      📬 ${escapeHtml(job.email)} ${confidenceBadge}
    </div>
  `;
}

function getActionButtons(job) {
  let buttons = '';

  // Preview (only if cold email exists)
  if (job.coldEmailGenerated) {
    buttons += `<button class="btn btn-sm btn-primary" data-action="preview" data-id="${job.id}">👁 Preview</button>`;
    buttons += `<button class="btn btn-sm btn-blue" data-action="copy" data-id="${job.id}" title="Copy email body to clipboard">📋 Copy</button>`;
  }

  // Edit
  buttons += `<button class="btn btn-sm btn-purple" data-action="edit" data-id="${job.id}">✏️ Edit</button>`;

  // Accept (for suggested emails)
  if (job.emailConfidence === 'suggested') {
    buttons += `<button class="btn btn-sm btn-secondary" data-action="accept-email" data-id="${job.id}">✓ Accept</button>`;
  }

  // Send (only if ready)
  if (job.status === 'ready') {
    buttons += `<button class="btn btn-sm btn-green" data-action="send" data-id="${job.id}">📤 Send</button>`;
  }

  // Retry (only if failed)
  if (job.status === 'failed') {
    buttons += `<button class="btn btn-sm btn-secondary" data-action="retry" data-id="${job.id}">🔄 Retry</button>`;
  }

  // Delete
  buttons += `<button class="btn btn-sm btn-secondary" data-action="delete" data-id="${job.id}" title="Remove" style="padding:5px 8px;">✕</button>`;

  return buttons;
}

function bindJobCardActions(card, job) {
  card.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      switch (action) {
        case 'preview': openPreviewModal(id); break;
        case 'copy': handleCopyEmail(id); break;
        case 'edit': openEditModal(id); break;
        case 'send': handleSendSingle(id); break;
        case 'delete': handleDeleteJob(id); break;
        case 'accept-email': handleAcceptEmail(id); break;
        case 'retry': handleRetryJob(id); break;
        case 'set-email': break; // Handled by input
      }
    });
  });

  // Email input handler (for missing emails)
  const emailInput = card.querySelector('[data-action="set-email"]');
  if (emailInput) {
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const email = emailInput.value.trim();
        if (VALIDATORS.email(email)) {
          JobState.updateJob(job.id, {
            email: email,
            emailSource: 'user_input',
            emailConfidence: 'verified',
          });
          showToast(`Email set for ${job.company}`, 'success');
        } else {
          showToast('Invalid email address.', 'warning');
          emailInput.classList.add('error');
        }
      }
    });

    emailInput.addEventListener('blur', () => {
      emailInput.classList.remove('error');
    });
  }
}

// ============ JOB ACTIONS ============
async function handleSendSingle(jobId) {
  const job = JobState.getJob(jobId);
  if (!job) return;

  if (!job.email || !VALIDATORS.email(job.email)) {
    showToast('No valid email address for this job.', 'warning');
    return;
  }

  // Check email settings
  const emailSettings = await Storage.get(STORAGE_KEYS.EMAIL);
  if (!emailSettings.address || !emailSettings.appPassword) {
    showToast('Configure your Gmail SMTP settings first.', 'error', 'Fix Settings', () => {
      switchTab('quick-settings');
    });
    return;
  }

  JobState.markSending(jobId);
  showToast(`Sending email to ${job.email}...`, 'info');

  try {
    const attachments = [];
    const defaultAttachments = await Storage.get(STORAGE_KEYS.ATTACHMENTS);

    // 1. Resume (Override or Default)
    if (job.overrideResume) {
      attachments.push(job.overrideResume);
    } else if (defaultAttachments && defaultAttachments.resumeBase64 && defaultAttachments.resumeName) {
      attachments.push({
        name: defaultAttachments.resumeName,
        base64: defaultAttachments.resumeBase64
      });
    }

    // 2. Other Attachments (Override or Default)
    if (job.overrideAttachments && Array.isArray(job.overrideAttachments)) {
      attachments.push(...job.overrideAttachments);
    } else if (defaultAttachments && defaultAttachments.otherFiles && Array.isArray(defaultAttachments.otherFiles)) {
      attachments.push(...defaultAttachments.otherFiles);
    }


    const response = await chrome.runtime.sendMessage({
      type: 'SEND_EMAIL',
      toEmail: job.email,
      subject: job.emailSubject || `Regarding ${job.role} opportunity`,
      body: job.coldEmail,
      attachments: attachments
    });

    if (response && response.success) {
      JobState.markSent(jobId);
      showToast(`Email sent to ${job.email}!`, 'success');
    } else {
      throw new Error(response?.error || 'Unknown SMTP error.');
    }
  } catch (error) {
    JobState.markFailed(jobId, error.message);
    showToast(`Failed sending to ${job.email}: ${error.message}`, 'error');
  }
}

function handleCopyEmail(jobId) {
  const job = JobState.getJob(jobId);
  if (job && job.coldEmail) {
    navigator.clipboard.writeText(job.coldEmail);
    showToast('Cold email copied to clipboard!', 'success');
  } else {
    showToast('No email generated to copy.', 'warning');
  }
}

function handleDeleteJob(jobId) {
  const job = JobState.getJob(jobId);
  if (!job) return;

  showConfirm(
    'Delete Job?',
    `Remove "${job.role}" at ${job.company}? This cannot be undone.`,
    () => {
      JobState.removeJob(jobId);
      showToast('Job removed.', 'info');
    }
  );
}

function handleAcceptEmail(jobId) {
  JobState.updateJob(jobId, { emailConfidence: 'verified' });
  showToast('Email accepted as verified.', 'success');
}

function handleRetryJob(jobId) {
  JobState.retryJob(jobId);
  showToast('Job reset to Ready. You can try sending again.', 'info');
}

async function handleGenerateSelected() {
  const selectedReady = JobState.getJobs(false).filter(j => 
    JobState.isSelected(j.id) && j.email && !j.coldEmailGenerated
  );

  if (selectedReady.length === 0) {
    showToast('No selected jobs need email generation.', 'warning');
    return;
  }

  showLoading(`Generating emails for ${selectedReady.length} job(s)...`);

  try {
    for (let i = 0; i < selectedReady.length; i++) {
      const job = selectedReady[i];
      showLoading(`Generating email ${i + 1}/${selectedReady.length} for ${job.company}...`);

      const res = await chrome.runtime.sendMessage({
        type: 'GENERATE_EMAIL',
        job: job,
        tone: settingsDOM.promptTone.value,
        instructions: settingsDOM.promptInstructions.value.trim()
      });

      if (res && res.success) {
        JobState.updateJob(job.id, {
          coldEmail: res.body,
          emailSubject: res.subject,
          coldEmailGenerated: true,
          status: 'ready'
        });
      } else {
        showToast(`Generation failed for ${job.company}: ${res?.error || 'Unknown Error'}`, 'error');
      }
    }
    showToast(`Successfully generated emails for ${selectedReady.length} jobs!`, 'success');
  } catch (err) {
    showToast('Failed to generate emails: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

async function handleProcessImport() {
  try {
    // 0. Scrape descriptions for jobs that have a URL but no description
    let currentJobs = JobState.getJobs(false);
    const needScraping = currentJobs.filter(j => j.sourceUrl && (!j.description || j.description.length < 20));
    if (needScraping.length > 0) {
      showLoading(`Scraping descriptions for ${needScraping.length} job(s)...`);
      for (let i = 0; i < needScraping.length; i++) {
        const job = needScraping[i];
        showLoading(`Scraping page ${i + 1}/${needScraping.length} for ${job.company || 'Job'}...`);
        try {
          const res = await fetch(job.sourceUrl);
          const html = await res.text();
          const cleanText = html
            .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
            .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          showLoading(`Extracting details ${i + 1}/${needScraping.length} for ${job.company || 'Job'}...`);
          const extractResponse = await chrome.runtime.sendMessage({
            type: 'EXTRACT_JOBS',
            pageContent: cleanText,
            pageUrl: job.sourceUrl
          });

          if (extractResponse.success && extractResponse.jobs && extractResponse.jobs.length > 0) {
            const extractedJob = extractResponse.jobs[0];
            JobState.updateJob(job.id, {
              description: extractedJob.description || job.description,
              skills: extractedJob.skills || job.skills,
              role: (job.role === 'Unknown Role' || !job.role) ? (extractedJob.role || job.role) : job.role,
              company: (job.company === 'Unknown Company' || !job.company) ? (extractedJob.company || job.company) : job.company,
            });
          }
        } catch (err) {
          console.error(`Failed to scrape/extract URL for ${job.company}:`, err);
        }
      }
    }

    // 1. Discover emails for all jobs missing them
    currentJobs = JobState.getJobs(false);
    const needEmails = currentJobs.filter(j => !j.email && j.emailConfidence === 'missing');
    if (needEmails.length > 0) {
      showLoading(`Finding email addresses for ${needEmails.length} job(s)...`);
      for (let i = 0; i < needEmails.length; i++) {
        const job = needEmails[i];
        if (job.company === 'Unknown Company' || !job.company) continue;

        showLoading(`Searching emails ${i + 1}/${needEmails.length} for ${job.company}...`);
        const response = await chrome.runtime.sendMessage({
          type: 'FIND_CONTACTS',
          company: job.company,
          pageUrl: job.sourceUrl || ''
        });

        if (response && response.success && response.contacts && response.contacts.length > 0) {
          const sorted = response.contacts.sort((a, b) => {
            const score = { verified: 3, suggested: 2, missing: 1 };
            return score[b.confidence] - score[a.confidence];
          });

          const contact = sorted[0];
          JobState.updateJob(job.id, {
            email: contact.email,
            emailSource: contact.source,
            emailConfidence: contact.confidence
          });
        }
      }
    }

    // 2. Generate cold email drafts for all jobs that now have emails but no cold email
    currentJobs = JobState.getJobs(false);
    const needGen = currentJobs.filter(j => j.email && !j.coldEmailGenerated);
    if (needGen.length > 0) {
      showLoading(`Generating emails for ${needGen.length} job(s)...`);
      for (let i = 0; i < needGen.length; i++) {
        const job = needGen[i];
        showLoading(`Generating email ${i + 1}/${needGen.length} for ${job.company}...`);

        const res = await chrome.runtime.sendMessage({
          type: 'GENERATE_EMAIL',
          job: job,
          tone: settingsDOM.promptTone.value,
          instructions: settingsDOM.promptInstructions.value.trim()
        });

        if (res && res.success) {
          JobState.updateJob(job.id, {
            coldEmail: res.body,
            emailSubject: res.subject,
            coldEmailGenerated: true,
            status: 'ready'
          });
        }
      }
    }

    showToast('Import processing completed!', 'success');
  } catch (error) {
    showToast('Failed to process CSV import: ' + error.message, 'error');
  } finally {
    hideLoading();
    importAnalysis.classList.add('hidden');
  }
}

// ============ PREVIEW MODAL ============
async function openPreviewModal(jobId) {
  const job = JobState.getJob(jobId);
  if (!job) return;

  currentPreviewJobId = jobId;

  previewModalTitle.textContent = `📧 ${job.role} @ ${job.company}`;
  previewTo.textContent = job.email || 'No email set';
  previewSubject.textContent = job.emailSubject || `Regarding ${job.role} opportunity`;
  previewBody.textContent = job.coldEmail || 'No email generated yet.';

  // Attachments
  previewAttachments.innerHTML = '';
  try {
    const defaultAttachments = await Storage.get(STORAGE_KEYS.ATTACHMENTS);
    const attachmentsList = [];

    // 1. Resume (Override or Default)
    if (job.overrideResume) {
      attachmentsList.push({ name: job.overrideResume.name, isOverride: true });
    } else if (defaultAttachments && defaultAttachments.resumeBase64 && defaultAttachments.resumeName) {
      attachmentsList.push({ name: defaultAttachments.resumeName, isOverride: false });
    }

    // 2. Other Attachments (Override or Default)
    if (job.overrideAttachments && Array.isArray(job.overrideAttachments)) {
      job.overrideAttachments.forEach(att => attachmentsList.push({ name: att.name, isOverride: true }));
    } else if (defaultAttachments && defaultAttachments.otherFiles && Array.isArray(defaultAttachments.otherFiles)) {
      defaultAttachments.otherFiles.forEach(att => attachmentsList.push({ name: att.name, isOverride: false }));
    }

    if (attachmentsList.length === 0) {
      previewAttachments.innerHTML = '<span class="text-sm text-gray" style="color:var(--text-muted);">No attachments</span>';
    } else {
      attachmentsList.forEach(att => {
        const span = document.createElement('span');
        span.className = 'file-chip';
        span.textContent = `📄 ${att.name}${att.isOverride ? ' (custom)' : ''}`;
        previewAttachments.appendChild(span);
      });
    }
  } catch (err) {
    console.error('[Preview] Failed to load attachments for preview:', err);
    previewAttachments.innerHTML = '<span class="text-sm text-red" style="color:var(--accent-red);">Failed to load attachments info</span>';
  }

  previewModal.classList.remove('hidden');
}

// ============ EDIT MODAL ============
function openEditModal(jobId) {
  const job = JobState.getJob(jobId);
  if (!job) return;

  currentEditJobId = jobId;
  editOverrides = {
    resume: job.overrideResume,
    portfolioLinks: job.overridePortfolio ? [...job.overridePortfolio] : null,
  };

  editModalTitle.textContent = `✏️ ${job.role} @ ${job.company}`;
  editEmail.value = job.email;
  editSubject.value = job.emailSubject || '';
  editColdEmail.value = job.coldEmail;

  // Update badges
  updateEditBadge('edit-email-badge', job.email && job.emailSource !== 'none');
  updateEditBadge('edit-cold-email-badge', job.coldEmailGenerated);
  updateEditBadge('edit-resume-badge', !!job.overrideResume);
  updateEditBadge('edit-attach-badge', !!job.overridePortfolio);

  // Resume chip
  if (job.overrideResume) {
    editResumeChip.textContent = `📄 ${job.overrideResume.name}`;
  } else {
    editResumeChip.textContent = '📄 Using default';
  }

  // Portfolio links
  renderEditPortfolioLinks(job.overridePortfolio || []);

  // Close preview if open
  previewModal.classList.add('hidden');

  editModal.classList.remove('hidden');
}

function updateEditBadge(id, isCustom) {
  const badge = $(`#${id}`);
  if (!badge) return;
  badge.className = `override-badge ${isCustom ? 'custom' : 'default'}`;
  badge.textContent = isCustom ? '✏️ Custom' : 'Using default';
}

function renderEditPortfolioLinks(links) {
  editPortfolioLinks.innerHTML = '';
  links.forEach((link, i) => {
    const chip = document.createElement('span');
    chip.className = 'file-chip';
    chip.innerHTML = `🔗 ${truncateUrl(link)} <span class="remove" data-link-index="${i}">✕</span>`;
    chip.querySelector('.remove').addEventListener('click', () => {
      if (!editOverrides.portfolioLinks) editOverrides.portfolioLinks = [...links];
      editOverrides.portfolioLinks.splice(i, 1);
      renderEditPortfolioLinks(editOverrides.portfolioLinks);
    });
    editPortfolioLinks.appendChild(chip);
  });
}

// ============ MODAL BINDINGS ============
function bindModals() {
  // Preview modal
  $('#preview-modal-close').addEventListener('click', () => previewModal.classList.add('hidden'));
  previewCloseBtn.addEventListener('click', () => previewModal.classList.add('hidden'));
  previewEditBtn.addEventListener('click', () => {
    if (currentPreviewJobId) openEditModal(currentPreviewJobId);
  });
  previewCopyBtn.addEventListener('click', () => {
    if (currentPreviewJobId) {
      const job = JobState.getJob(currentPreviewJobId);
      if (job && job.coldEmail) {
        navigator.clipboard.writeText(job.coldEmail);
        showToast('Cold email draft copied to clipboard!', 'success');
      }
    }
  });
  previewGmailBtn.addEventListener('click', async () => {
    if (currentPreviewJobId) {
      const job = JobState.getJob(currentPreviewJobId);
      if (job) {
        const recipient = encodeURIComponent(job.email || '');
        const subject = encodeURIComponent(job.emailSubject || `Regarding ${job.role} opening`);
        const body = encodeURIComponent(job.coldEmail || '');
        // Include authuser so Gmail tries to open in the configured sender account
        let authUser = '';
        try {
          const emailSettings = await Storage.get(STORAGE_KEYS.EMAIL);
          if (emailSettings && emailSettings.address) {
            authUser = `&authuser=${encodeURIComponent(emailSettings.address)}`;
          }
        } catch (e) { /* non-critical */ }
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1${authUser}&to=${recipient}&su=${subject}&body=${body}`;
        chrome.tabs.create({ url: gmailUrl });
        showToast('Opening Gmail Compose in your configured account...', 'success');
      }
    }
  });
  previewSendBtn.addEventListener('click', () => {
    if (currentPreviewJobId) {
      previewModal.classList.add('hidden');
      handleSendSingle(currentPreviewJobId);
    }
  });

  // Edit modal
  $('#edit-modal-close').addEventListener('click', () => editModal.classList.add('hidden'));
  editCancelBtn.addEventListener('click', () => editModal.classList.add('hidden'));
  editRegenerateBtn.addEventListener('click', handleEditRegenerate);
  editSaveBtn.addEventListener('click', saveEditChanges);

  // Resume change
  editResumeChange.addEventListener('click', () => editResumeInput.click());
  editResumeInput.addEventListener('change', handleEditResumeChange);

  // Add portfolio link
  editAddLink.addEventListener('click', () => {
    const link = editNewLink.value.trim();
    if (!VALIDATORS.url(link)) {
      showToast('Invalid URL format.', 'warning');
      editNewLink.classList.add('error');
      return;
    }
    if (!editOverrides.portfolioLinks) editOverrides.portfolioLinks = [];
    editOverrides.portfolioLinks.push(link);
    renderEditPortfolioLinks(editOverrides.portfolioLinks);
    editNewLink.value = '';
    editNewLink.classList.remove('error');
  });

  editNewLink.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') editAddLink.click();
  });

  // Confirm modal
  confirmCancel.addEventListener('click', () => confirmModal.classList.add('hidden'));
  confirmOk.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });

  // Close modals on overlay click
  [previewModal, editModal, confirmModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });
}

async function handleEditRegenerate() {
  if (!currentEditJobId) return;

  const job = JobState.getJob(currentEditJobId);
  if (!job) return;

  // Build temporary job with modal's current overrides applied
  const tempJob = {
    ...job,
    overrideResume: editOverrides.resume,
    overridePortfolio: editOverrides.portfolioLinks
  };

  showLoading('Regenerating email...');
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'GENERATE_EMAIL',
      job: tempJob,
      tone: settingsDOM.promptTone.value,
      instructions: settingsDOM.promptInstructions.value.trim()
    });

    if (res && res.success) {
      editColdEmail.value = res.body;
      editSubject.value = res.subject;
      updateEditBadge('edit-cold-email-badge', true);
      showToast('Email regenerated!', 'success');
    } else {
      showToast('Regeneration failed: ' + (res?.error || 'Unknown Error'), 'error');
    }
  } catch (err) {
    showToast('Regeneration failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

function saveEditChanges() {
  if (!currentEditJobId) return;

  const updates = {};

  // Email
  const newEmail = editEmail.value.trim();
  if (newEmail && VALIDATORS.email(newEmail)) {
    updates.email = newEmail;
    updates.emailSource = 'user_input';
    updates.emailConfidence = 'verified';
  } else if (newEmail && !VALIDATORS.email(newEmail)) {
    showToast('Invalid email address.', 'warning');
    editEmail.classList.add('error');
    return;
  }

  // Subject
  updates.emailSubject = editSubject.value.trim();

  // Cold email
  const newColdEmail = editColdEmail.value.trim();
  if (newColdEmail) {
    updates.coldEmail = newColdEmail;
    updates.coldEmailGenerated = true;
  }

  // Resume override
  if (editOverrides.resume) {
    updates.overrideResume = editOverrides.resume;
  }

  // Portfolio links override
  if (editOverrides.portfolioLinks) {
    updates.overridePortfolio = editOverrides.portfolioLinks;
  }

  JobState.updateJob(currentEditJobId, updates);
  editModal.classList.add('hidden');
  showToast('Changes saved!', 'success');
  currentEditJobId = null;
}

function handleEditResumeChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > FILE_LIMITS.RESUME_MAX_BYTES) {
    showToast('Resume file is too large (max 5MB).', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    editOverrides.resume = { name: file.name, base64: e.target.result };
    editResumeChip.textContent = `📄 ${file.name}`;
    updateEditBadge('edit-resume-badge', true);
  };
  reader.readAsDataURL(file);
}

// ============ SEARCH TAB ============
function bindSearchTab() {
  btnSearch.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
}

async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    showToast('Enter a search query.', 'warning');
    return;
  }

  searchResults.innerHTML = '<div class="search-loading"><div class="spinner"></div><p class="text-sm mt-8">Searching...</p></div>';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH_JOBS',
      query: query,
      provider: searchProvider.value
    });

    if (response && response.success && response.jobs) {
      searchResults.innerHTML = '';
      
      if (response.jobs.length === 0) {
        searchResults.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h3>No jobs found</h3>
            <p>Try searching using other keywords or location.</p>
          </div>
        `;
        return;
      }

      response.jobs.forEach(job => {
        const card = document.createElement('div');
        card.className = 'job-card pixel-card';
        card.innerHTML = `
          <div class="job-card-header">
            <div class="job-card-left">
              <div>
                <div class="job-title">${escapeHtml(job.role)}</div>
                <div class="job-company">${escapeHtml(job.company)}</div>
              </div>
            </div>
            <button class="btn btn-sm btn-primary add-search-job-btn">➕ Add</button>
          </div>
          <div class="text-xs text-muted mt-4">${escapeHtml(job.description.substring(0, 150))}...</div>
        `;

        card.querySelector('.add-search-job-btn').addEventListener('click', () => {
          job.id = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          job.scrapedAt = new Date().toISOString();
          job.status = 'scraped';
          job.email = '';
          job.emailSource = 'none';
          job.emailConfidence = 'missing';
          job.coldEmail = '';
          job.coldEmailGenerated = false;

          JobState.addJob(job);
          showToast(`Added ${job.role} at ${job.company} to Workspace!`, 'success');
          card.querySelector('.add-search-job-btn').disabled = true;
          card.querySelector('.add-search-job-btn').textContent = 'Added';
        });

        searchResults.appendChild(card);
      });
    } else {
      searchResults.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h3>Search failed</h3>
          <p>${response?.error || 'Failed to search jobs.'}</p>
        </div>
      `;
    }
  } catch (error) {
    searchResults.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <h3>Search error</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// ============ INTEGRATED SYSTEM SETTINGS ============

function updateSidepanelApiKeyHints() {
  const llm = LLM_PROVIDERS.find(p => p.value === settingsDOM.llmProvider.value);
  settingsDOM.llmKeyHint.innerHTML = llm ? llm.hint : '';

  const search = SEARCH_PROVIDERS.find(p => p.value === settingsDOM.searchProvider.value);
  settingsDOM.searchKeyHint.innerHTML = search ? search.hint : '';
}

async function loadSidepanelSettings() {
  try {
    // 1. Profile
    const profile = await Storage.get(STORAGE_KEYS.PROFILE);
    settingsDOM.profileName.value = profile.name || '';
    settingsDOM.profileRole.value = profile.role || '';
    settingsDOM.profileCompany.value = profile.company || '';
    settingsDOM.profileSkills.value = profile.skills || '';
    settingsDOM.profileBio.value = profile.bio || '';

    // 2. AI Keys & Backend
    const apiKeys = await Storage.get(STORAGE_KEYS.API_KEYS);
    settingsDOM.llmProvider.value = apiKeys.llmProvider || 'groq';
    settingsDOM.llmKey.value = apiKeys.llmKey || '';
    const activeModel = apiKeys.llmModel || 'llama-3.3-70b-versatile';
    settingsDOM.llmModel.innerHTML = `<option value="${activeModel}">${activeModel}</option>`;
    settingsDOM.searchProvider.value = apiKeys.searchProvider || 'jsearch';
    settingsDOM.searchKey.value = apiKeys.searchKey || '';
    updateSidepanelApiKeyHints();

    const backendUrl = await Storage.get(STORAGE_KEYS.BACKEND_URL);
    settingsDOM.backendUrl.value = backendUrl || 'http://localhost:8000';

    // Restore Gmail auth badge state from storage (done after DOM is fully ready)
    const savedEmail = await Storage.get(STORAGE_KEYS.EMAIL);
    if (savedEmail && savedEmail.address && savedEmail.appPassword) {
      // Credentials saved but not yet verified this session
      // Use requestAnimationFrame to ensure DOM elements are ready
      requestAnimationFrame(() => setGmailAuthUI('unverified', null));
    }

    // 3. Email (SMTP)
    const email = await Storage.get(STORAGE_KEYS.EMAIL);
    settingsDOM.emailAddress.value = email.address || '';
    settingsDOM.emailPassword.value = email.appPassword || '';
    settingsDOM.emailSignature.value = email.signature || '';

    // 4. Attachments & Portfolios
    const attachments = await Storage.get(STORAGE_KEYS.ATTACHMENTS);
    sidepanelAttachmentsState = {
      resumeBase64: attachments.resumeBase64 || '',
      resumeName: attachments.resumeName || '',
      portfolioLinks: attachments.portfolioLinks || []
    };
    renderSidepanelResumeStatus();
    renderSidepanelPortfolioLinks();

    // 5. Tone & Instructions
    const prompt = await Storage.get(STORAGE_KEYS.PROMPT);
    settingsDOM.promptTone.value = prompt.tone || 'professional';
    settingsDOM.promptInstructions.value = prompt.instructions || '';
  } catch (err) {
    console.error('[Sidepanel] Failed to load settings:', err);
    showToast('Failed to load settings.', 'error');
  }
}

async function saveSidepanelSettings() {
  try {
    // Validate inputs
    if (settingsDOM.emailAddress.value && !VALIDATORS.email(settingsDOM.emailAddress.value)) {
      showToast('Please enter a valid Gmail address.', 'error');
      settingsDOM.emailAddress.focus();
      return false;
    }
    if (settingsDOM.backendUrl.value && !VALIDATORS.url(settingsDOM.backendUrl.value)) {
      showToast('Please enter a valid backend URL.', 'error');
      settingsDOM.backendUrl.focus();
      return false;
    }

    // Read portfolio links from inputs
    const linkInputs = settingsDOM.portfolioContainer.querySelectorAll('.portfolio-link-input');
    sidepanelAttachmentsState.portfolioLinks = Array.from(linkInputs)
      .map(input => input.value.trim())
      .filter(link => link.length > 0);

    // Validate URLs
    for (const link of sidepanelAttachmentsState.portfolioLinks) {
      if (!VALIDATORS.url(link)) {
        showToast(`Invalid portfolio link URL: ${link}`, 'error');
        return false;
      }
    }

    // 1. Save Profile
    await Storage.set(STORAGE_KEYS.PROFILE, {
      name: settingsDOM.profileName.value.trim(),
      role: settingsDOM.profileRole.value.trim(),
      company: settingsDOM.profileCompany.value.trim(),
      skills: settingsDOM.profileSkills.value.trim(),
      bio: settingsDOM.profileBio.value.trim(),
    });

    // 2. Save API Keys
    await Storage.set(STORAGE_KEYS.API_KEYS, {
      llmProvider: settingsDOM.llmProvider.value,
      llmKey: settingsDOM.llmKey.value.trim(),
      llmModel: settingsDOM.llmModel.value,
      searchProvider: settingsDOM.searchProvider.value,
      searchKey: settingsDOM.searchKey.value.trim(),
    });

    // 3. Save SMTP Email
    await Storage.set(STORAGE_KEYS.EMAIL, {
      address: settingsDOM.emailAddress.value.trim(),
      appPassword: settingsDOM.emailPassword.value.trim(),
      signature: settingsDOM.emailSignature.value,
    });

    // 4. Save Attachments
    const currentAttachments = await Storage.get(STORAGE_KEYS.ATTACHMENTS);
    await Storage.set(STORAGE_KEYS.ATTACHMENTS, {
      ...currentAttachments,
      resumeBase64: sidepanelAttachmentsState.resumeBase64,
      resumeName: sidepanelAttachmentsState.resumeName,
      portfolioLinks: sidepanelAttachmentsState.portfolioLinks,
    });

    // 5. Save Writing Tone & Instructions
    const currentPrompt = await Storage.get(STORAGE_KEYS.PROMPT);
    await Storage.set(STORAGE_KEYS.PROMPT, {
      ...currentPrompt,
      tone: settingsDOM.promptTone.value,
      instructions: settingsDOM.promptInstructions.value.trim(),
    });

    // 6. Save Backend URL
    await Storage.set(STORAGE_KEYS.BACKEND_URL, settingsDOM.backendUrl.value.trim());

    // Update greeting
    await updateGreeting();

    // Trigger ChromaDB load for portfolio links
    const baseUrl = settingsDOM.backendUrl.value.trim() || 'http://localhost:8000';
    const api = new ColdCraftAPI(baseUrl);
    const skillsText = settingsDOM.profileSkills.value.trim();
    const portfolioItems = sidepanelAttachmentsState.portfolioLinks.map(link => {
      const matched = [];
      const words = skillsText.split(',').map(s => s.trim().toLowerCase());
      words.forEach(w => {
        if (w && link.toLowerCase().includes(w)) {
          matched.push(w);
        }
      });
      return {
        techstack: matched.length > 0 ? matched.join(', ') : skillsText,
        links: link
      };
    });

    if (portfolioItems.length > 0) {
      try {
        await api.loadPortfolio(portfolioItems);
        console.log('[Sidepanel] Portfolio synced with backend ChromaDB.');
      } catch (err) {
        console.warn('[Sidepanel] ChromaDB mapping sync failed:', err);
      }
    }

    showToast('All settings saved successfully!', 'success');
    return true;
  } catch (err) {
    console.error('[Sidepanel] Save error:', err);
    showToast(`Failed to save settings: ${err.message}`, 'error');
    return false;
  }
}

function bindSidepanelSettings() {
  // Password visible toggle
  $$('.toggle-password-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });

  // LLM and Search providers hints
  settingsDOM.llmProvider.addEventListener('change', updateSidepanelApiKeyHints);
  settingsDOM.searchProvider.addEventListener('change', updateSidepanelApiKeyHints);

  // Save button
  settingsDOM.saveAllBtn.addEventListener('click', async () => {
    settingsDOM.saveAllBtn.disabled = true;
    const ok = await saveSidepanelSettings();
    settingsDOM.saveAllBtn.disabled = false;
  });

  // Fetch models button
  settingsDOM.fetchModelsBtn.addEventListener('click', async () => {
    const provider = settingsDOM.llmProvider.value;
    const apiKey = settingsDOM.llmKey.value.trim();
    const baseUrl = settingsDOM.backendUrl.value.trim().replace(/\/docs\/?$/, '').replace(/\/+$/, '') || 'http://localhost:8000';
    
    if (!apiKey) {
      showToast('Please enter an LLM API Key first.', 'warning');
      settingsDOM.llmKey.focus();
      return;
    }

    settingsDOM.fetchModelsBtn.disabled = true;
    settingsDOM.fetchModelsBtn.textContent = '🔄 Fetching...';

    try {
      const apiClient = new ColdCraftAPI(baseUrl);
      const data = await apiClient.fetchModels(provider, apiKey);
      if (data && data.success && data.models) {
        settingsDOM.llmModel.innerHTML = '';
        data.models.forEach(model => {
          const opt = document.createElement('option');
          opt.value = model;
          opt.textContent = model;
          settingsDOM.llmModel.appendChild(opt);
        });
        showToast(`Successfully fetched ${data.models.length} models!`, 'success');
      } else {
        throw new Error(data.error || 'Failed to retrieve models list.');
      }
    } catch (err) {
      showToast('Fetch Models failed: ' + err.message, 'error');
    } finally {
      settingsDOM.fetchModelsBtn.disabled = false;
      settingsDOM.fetchModelsBtn.textContent = '🔄 Fetch';
    }
  });

  // ---- Verify Gmail credentials ----
  settingsDOM.verifyGmailBtn.addEventListener('click', async () => {
    const gmailAddress = settingsDOM.emailAddress.value.trim();
    // Strip spaces — App Passwords are displayed with spaces ("xxxx xxxx xxxx xxxx") but used without
    const appPassword = settingsDOM.emailPassword.value.trim().replace(/\s+/g, '');

    if (!gmailAddress) {
      showToast('Enter your Gmail address first.', 'warning');
      settingsDOM.emailAddress.focus();
      return;
    }
    if (!appPassword) {
      showToast('Enter your Gmail App Password first.', 'warning');
      settingsDOM.emailPassword.focus();
      return;
    }
    if (!VALIDATORS.email(gmailAddress)) {
      showToast('Enter a valid Gmail address (e.g. yourname@gmail.com).', 'warning');
      settingsDOM.emailAddress.focus();
      return;
    }
    if (appPassword.length !== 16) {
      setGmailAuthUI('invalid',
        `❌ App Password must be 16 characters (you entered ${appPassword.length}). ` +
        'Go to myaccount.google.com/apppasswords to generate one. ' +
        'Note: Copy the password exactly as shown (spaces are auto-removed).');
      showToast('App Password must be exactly 16 characters.', 'error');
      return;
    }

    // Show loading state
    settingsDOM.verifyGmailBtn.disabled = true;
    settingsDOM.verifyGmailBtn.textContent = '🔄 Verifying...';
    setGmailAuthUI('loading', '⏳ Connecting to Gmail SMTP servers... (this may take ~10s)');

    const baseUrl = settingsDOM.backendUrl.value.trim().replace(/\/docs\/?$/, '').replace(/\/+$/, '') || 'http://localhost:8000';
    try {
      const apiClient = new ColdCraftAPI(baseUrl);
      // Pass the space-stripped password to backend
      const result = await apiClient.verifySmtp(gmailAddress, appPassword);

      if (result && result.success) {
        setGmailAuthUI('verified',
          '✅ Gmail credentials verified! Auto-Send is now ready to use.');
        showToast('✅ Gmail connected! Credentials are valid.', 'success');
        // Auto-save credentials immediately on successful verify
        await Storage.set(STORAGE_KEYS.EMAIL, {
          address: gmailAddress,
          appPassword: appPassword, // store stripped version
          signature: settingsDOM.emailSignature.value,
        });
      } else {
        throw new Error(result.error || 'Verification returned an unexpected response.');
      }
    } catch (err) {
      let userMsg = err.message;
      // Make SMTP auth error more actionable
      if (userMsg.includes('Authentication failed') || userMsg.includes('auth')) {
        userMsg = '❌ Wrong credentials. Make sure:\n' +
          '1. You entered the correct Gmail address\n' +
          '2. You used a Google App Password (not your Gmail password)\n' +
          '3. 2-Step Verification is ON at myaccount.google.com/security';
      } else {
        userMsg = '❌ ' + userMsg;
      }
      setGmailAuthUI('invalid', userMsg);
      showToast('Gmail verification failed. Check the error below.', 'error');
    } finally {
      settingsDOM.verifyGmailBtn.disabled = false;
      settingsDOM.verifyGmailBtn.textContent = '🔐 Verify Gmail Credentials';
    }
  });

  // Connection testing
  settingsDOM.testConnBtn.addEventListener('click', async () => {
    settingsDOM.testConnBtn.disabled = true;
    settingsDOM.testConnBtn.textContent = '🔄 Testing...';
    try {
      const rawUrl = settingsDOM.backendUrl.value.trim();
      const baseUrl = rawUrl.replace(/\/docs\/?$/, '').replace(/\/+$/, '') || 'http://localhost:8000';
      const apiClient = new ColdCraftAPI(baseUrl);
      const data = await apiClient.checkHealth();
      if (data && data.status) {
        showToast('✅ Backend Online! Connection successful.', 'success');
        // Update the field to the cleaned URL
        settingsDOM.backendUrl.value = baseUrl;
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      showToast('❌ Failed to connect to backend: ' + err.message, 'error');
    } finally {
      settingsDOM.testConnBtn.disabled = false;
      settingsDOM.testConnBtn.textContent = '⚡ Test Server Connection';
    }
  });

  // Resume Drag & Drop
  settingsDOM.resumeDropzone.addEventListener('click', () => settingsDOM.resumeInput.click());
  settingsDOM.resumeInput.addEventListener('change', (e) => {
    handleSidepanelResumeFile(e.target.files[0]);
  });
  settingsDOM.resumeDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    settingsDOM.resumeDropzone.style.background = 'var(--accent-yellow-light)';
  });
  settingsDOM.resumeDropzone.addEventListener('dragleave', () => {
    settingsDOM.resumeDropzone.style.background = 'var(--bg-input)';
  });
  settingsDOM.resumeDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    settingsDOM.resumeDropzone.style.background = 'var(--bg-input)';
    handleSidepanelResumeFile(e.dataTransfer.files[0]);
  });
  settingsDOM.removeResumeBtn.addEventListener('click', () => {
    sidepanelAttachmentsState.resumeBase64 = '';
    sidepanelAttachmentsState.resumeName = '';
    renderSidepanelResumeStatus();
    showToast('Resume removed (Click Save to apply changes).', 'info');
  });

  // Portfolio links
  settingsDOM.addPortfolioBtn.addEventListener('click', () => addSidepanelPortfolioLinkRow(''));

  // Export Settings
  settingsDOM.exportSettingsBtn.addEventListener('click', async () => {
    try {
      const dataStr = await Storage.exportSettings();
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const filename = `coldcraft_settings_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = filename;
      a.click();
      showToast('Settings exported!', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  });

  // Import Settings
  settingsDOM.importTriggerBtn.addEventListener('click', () => settingsDOM.importSettingsInput.click());
  settingsDOM.importSettingsInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const success = await Storage.importSettings(evt.target.result);
        if (success) {
          showToast('Settings imported successfully! Reloading...', 'success');
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  });

  // Reset Settings
  settingsDOM.resetAllBtn.addEventListener('click', () => {
    showConfirm(
      'FACTORY RESET',
      'WARNING: This will wipe out all API keys, your email credentials, and profile. This action cannot be undone. Are you absolutely sure?',
      async () => {
        const success = await Storage.resetAll();
        if (success) {
          showToast('Factory reset complete. Reloading...', 'success');
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    );
  });
}

function renderSidepanelResumeStatus() {
  if (sidepanelAttachmentsState.resumeName && sidepanelAttachmentsState.resumeBase64) {
    settingsDOM.resumeDropzone.classList.add('hidden');
    settingsDOM.resumeStatus.classList.remove('hidden');
    settingsDOM.resumeNameDisplay.textContent = sidepanelAttachmentsState.resumeName;
  } else {
    settingsDOM.resumeDropzone.classList.remove('hidden');
    settingsDOM.resumeStatus.classList.add('hidden');
    settingsDOM.resumeNameDisplay.textContent = '';
  }
}

function handleSidepanelResumeFile(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') {
    showToast('Only PDF files are supported.', 'error');
    return;
  }
  if (file.size > FILE_LIMITS.RESUME_MAX_BYTES) {
    showToast('Resume file size exceeds the 5MB limit.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    sidepanelAttachmentsState.resumeBase64 = e.target.result;
    sidepanelAttachmentsState.resumeName = file.name;
    renderSidepanelResumeStatus();
    showToast('Resume loaded (Click Save to apply changes).', 'info');
  };
  reader.readAsDataURL(file);
}

function renderSidepanelPortfolioLinks() {
  settingsDOM.portfolioContainer.innerHTML = '';
  const links = sidepanelAttachmentsState.portfolioLinks || [];
  if (links.length === 0) {
    addSidepanelPortfolioLinkRow('');
  } else {
    links.forEach(link => addSidepanelPortfolioLinkRow(link));
  }
}

function addSidepanelPortfolioLinkRow(val = '') {
  const row = document.createElement('div');
  row.className = 'portfolio-link-row';
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.marginBottom = '8px';
  row.innerHTML = `
    <input class="form-input portfolio-link-input" type="url" placeholder="https://myproject.com or github.com" value="${val}" style="flex:1;">
    <button type="button" class="btn btn-sm btn-danger remove-portfolio-row-btn" style="padding:2px 8px;">×</button>
  `;

  row.querySelector('.remove-portfolio-row-btn').addEventListener('click', () => {
    row.remove();
    if (settingsDOM.portfolioContainer.children.length === 0) {
      addSidepanelPortfolioLinkRow('');
    }
  });

  settingsDOM.portfolioContainer.appendChild(row);
}

// ============ FOOTER ============
function bindFooter() {
  // Auto-send toggle
  toggleAutosend.addEventListener('click', async () => {
    const isActive = toggleAutosend.classList.toggle('active');
    autosendStatus.textContent = isActive ? 'On (5s gap)' : 'Off';
    await Storage.update(STORAGE_KEYS.AUTOMATION, { autoSend: isActive });

    if (isActive) {
      showToast('Auto-send enabled. Emails will be sent automatically with delay.', 'warning');
    }
  });

  // Send All
  btnSendAll.addEventListener('click', handleSendAll);
}

async function loadAutomationState() {
  try {
    const automation = await Storage.get(STORAGE_KEYS.AUTOMATION);
    if (automation.autoSend) {
      toggleAutosend.classList.add('active');
      autosendStatus.textContent = `On (${automation.delaySeconds}s gap)`;
    }
  } catch (e) {
    // Default state is fine
  }
}

function updateSendButton() {
  const readySelected = JobState.getSelectedReady();
  sendCount.textContent = readySelected.length;
  btnSendAll.disabled = readySelected.length === 0;
}

async function handleSendAll() {
  const readyJobs = JobState.getSelectedReady();
  if (readyJobs.length === 0) {
    showToast('No selected jobs are ready to send.', 'warning');
    return;
  }

  // Check email settings first
  const emailSettings = await Storage.get(STORAGE_KEYS.EMAIL);
  if (!emailSettings.address || !emailSettings.appPassword) {
    showToast('Configure your Gmail SMTP in Settings first.', 'error', 'Fix Settings', () => {
      switchTab('quick-settings');
    });
    return;
  }

  showConfirm(
    `Send ${readyJobs.length} Email(s)?`,
    `This will send cold emails to ${readyJobs.length} recipient(s) in the background with configured delays. Continue?`,
    async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SEND_ALL',
          jobs: readyJobs
        });

        if (response && response.success) {
          showToast('Queued bulk emails in background thread!', 'success');
        } else {
          showToast(response?.error || 'Failed to start bulk send.', 'error');
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    }
  );
}

// ============ HEADER ACTIONS ============
function bindHeader() {
  btnExport.addEventListener('click', handleExportCSV);
  btnSettings.addEventListener('click', () => {
    switchTab('quick-settings');
  });
}

function handleExportCSV() {
  const jobs = JobState.getJobs(false); // All jobs, unfiltered
  if (jobs.length === 0) {
    showToast('No jobs to export.', 'warning');
    return;
  }

  // 1. Find the maximum number of extra attachments across all jobs
  let maxExtraAttachments = 0;
  jobs.forEach(job => {
    if (job.overrideAttachments && Array.isArray(job.overrideAttachments)) {
      maxExtraAttachments = Math.max(maxExtraAttachments, job.overrideAttachments.length);
    }
  });

  // 2. Build headers
  const headers = ['Company', 'Role', 'Email', 'Email Confidence', 'Status', 'Attachments'];
  for (let i = 2; i <= maxExtraAttachments + 1; i++) {
    headers.push(`Attachment ${i}`);
  }
  headers.push('Link', 'Cold Email', 'Source URL', 'Sent At');

  // Helper to format attachment as name;base64 or just name
  const formatAttachmentValue = (att) => {
    if (!att) return '';
    if (att.base64) {
      return `${att.name};${att.base64}`;
    }
    return att.name;
  };

  // 3. Build rows
  const rows = jobs.map(job => {
    const row = [
      job.company || '',
      job.role || '',
      job.email || '',
      job.emailConfidence || 'missing',
      job.status || 'scraped',
      formatAttachmentValue(job.overrideResume)
    ];

    // Add extra attachments
    for (let i = 0; i < maxExtraAttachments; i++) {
      const att = (job.overrideAttachments && job.overrideAttachments[i]) || null;
      row.push(formatAttachmentValue(att));
    }

    // Add Link (portfolio links joined by comma)
    const linksStr = (job.overridePortfolio && Array.isArray(job.overridePortfolio))
      ? job.overridePortfolio.join(', ')
      : '';
    row.push(linksStr);

    // Rest of the columns
    row.push(
      job.coldEmail || '',
      job.sourceUrl || '',
      job.sentAt || ''
    );

    return row;
  });

  const formatField = (val) => {
    const str = String(val).replace(/"/g, '""'); // Escape double quotes
    return `"${str}"`;
  };

  const csv = [
    headers.map(formatField).join(','),
    ...rows.map(row => row.map(formatField).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coldcraft-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`Exported ${jobs.length} job(s) to CSV.`, 'success');
}

// ============ STATE CHANGE HANDLER ============
async function onStateChange(event) {
  // Re-render whenever state changes
  renderJobList();
  updateStats();
  updateSendButton();

  // Save to storage
  try {
    await Storage.set(STORAGE_KEYS.JOB_HISTORY, JobState.serialize());
  } catch (e) {
    console.error('[SidePanel] Failed to save job history:', e);
  }
}

// ============ TOAST SYSTEM ============
function showToast(message, type = 'info', actionText = null, actionCallback = null) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let html = `<span class="toast-message">${escapeHtml(message)}</span>`;
  if (actionText) {
    html += `<span class="toast-action">${escapeHtml(actionText)}</span>`;
  }
  html += `<span class="toast-close">✕</span>`;
  toast.innerHTML = html;

  // Action click
  if (actionText && actionCallback) {
    toast.querySelector('.toast-action').addEventListener('click', actionCallback);
  }

  // Close click
  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());

  // Auto-dismiss
  const delay = type === 'error' ? 8000 : 4000;
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, delay);

  // Max 3 toasts
  const toasts = toastContainer.querySelectorAll('.toast');
  if (toasts.length >= 3) {
    toasts[0].remove();
  }

  toastContainer.appendChild(toast);
}

// ============ CONFIRM DIALOG ============
function showConfirm(title, message, callback) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmCallback = callback;
  confirmModal.classList.remove('hidden');
}

// ============ LOADING ============
function showLoading(text = 'Processing...') {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// ============ UTILITIES ============
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncateUrl(url, maxLen = 30) {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    return u.hostname + '/...';
  } catch {
    return url.substring(0, maxLen) + '...';
  }
}

/**
 * Update the Gmail auth status badge and detail message box.
 * @param {'unverified'|'loading'|'verified'|'invalid'} state
 * @param {string|null} message - Detail message to show, or null to hide
 */
function setGmailAuthUI(state, message) {
  const badge = settingsDOM.gmailAuthStatus;
  const detail = settingsDOM.gmailAuthDetail;
  if (!badge || !detail) return; // guard: DOM might not be ready

  // Reset badge classes
  badge.className = 'gmail-auth-badge';

  switch (state) {
    case 'loading':
      badge.classList.add('gmail-auth-unverified');
      badge.textContent = '⏳ Verifying...';
      detail.className = 'detail-loading';
      detail.style.display = message ? 'block' : 'none';
      detail.textContent = message || '';
      break;
    case 'verified':
      badge.classList.add('gmail-auth-verified');
      badge.textContent = '✅ Verified';
      detail.className = 'detail-success';
      detail.style.display = message ? 'block' : 'none';
      detail.textContent = message || '';
      break;
    case 'invalid':
      badge.classList.add('gmail-auth-invalid');
      badge.textContent = '❌ Invalid';
      detail.className = 'detail-error';
      detail.style.display = message ? 'block' : 'none';
      detail.textContent = message || '';
      break;
    default: // 'unverified'
      badge.classList.add('gmail-auth-unverified');
      badge.textContent = '● Not Verified';
      detail.style.display = 'none';
      detail.textContent = '';
      break;
  }
}

// ============ BACKGROUND COMMUNICATION & SYNC ============

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  // Listen for bulk sending progress reports from background worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SEND_ALL_PROGRESS') {
      const { current, total, company, status, error } = message.data;
      if (status === 'sending') {
        showToast(`Sending ${current}/${total}: ${company}...`, 'info');
      } else if (status === 'sent') {
        showToast(`Sent ${current}/${total}: ${company} successfully!`, 'success');
      } else if (status === 'failed') {
        showToast(`Failed ${current}/${total}: ${company} - ${error}`, 'error');
      }
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  // Sync sidepanel state with storage updates made by background workers
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[STORAGE_KEYS.JOB_HISTORY]) {
      const newVal = changes[STORAGE_KEYS.JOB_HISTORY].newValue;
      if (newVal) {
        const current = JSON.stringify(JobState.serialize());
        if (current !== JSON.stringify(newVal)) {
          JobState.deserialize(newVal);
        }
      }
    }
  });
}
