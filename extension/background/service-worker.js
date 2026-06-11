/**
 * ColdCraft AI — Background Service Worker
 * 
 * Central message hub for the extension.
 * Routes messages, manages background pipeline tasks (job extraction, email generation),
 * and handles bulk email sending with rate-limiting delays so that tasks continue
 * running even if the side panel is closed.
 */

// ============ LOAD UTILITIES ============
importScripts('../utils/constants.js', '../utils/storage.js', '../utils/api.js');

let api = null;

// Initialize API client from storage URL
async function getApiClient() {
  if (api) return api;
  const baseUrl = await Storage.get(STORAGE_KEYS.BACKEND_URL);
  api = new ColdCraftAPI(baseUrl || 'http://localhost:8000');
  return api;
}

// Listen for settings change to update backend URL (reset cached client)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes[STORAGE_KEYS.BACKEND_URL]) {
    // Reset cached client so next call re-reads the new URL
    api = null;
  }
});

// ============ EXTENSION LIFECYCLE ============
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(err => console.error('[SW] Failed to set panel behavior:', err));

// ============ MESSAGE ROUTING ============
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SW] Routing message:', message.type);

  switch (message.type) {
    case 'CHECK_HEALTH':
      handleHealthCheck(message)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'SCRAPE_ACTIVE_PAGE':
      handleScrapeActivePage()
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'EXTRACT_JOBS':
      handleExtractJobs(message)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'GENERATE_EMAIL':
      handleGenerateEmail(message)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'SEND_EMAIL':
      handleSendEmail(message)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'SEND_ALL':
      handleSendAllBulk(message)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'SEARCH_JOBS':
      handleSearchJobs(message)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'OPEN_SIDE_PANEL':
      handleOpenSidePanel(sender)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'OPEN_OPTIONS':
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      return false;

    default:
      console.warn('[SW] Unrouted message:', message.type);
      sendResponse({ success: false, error: 'Unrecognized message type' });
      return false;
  }
});

// ============ PIPELINE HANDLERS ============

/**
 * Check backend health
 */
async function handleHealthCheck(message) {
  try {
    const client = await getApiClient();
    const data = await client.checkHealth();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Scrape the active tab's page content
 */
async function handleScrapeActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    throw new Error('No active tab found.');
  }

  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    throw new Error('Cannot scrape browser internal pages. Navigate to a job board first.');
  }

  // Send message to content script
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
  if (response && response.success) {
    return { success: true, data: response.data };
  } else {
    throw new Error(response?.error || 'Failed to read content from the page.');
  }
}

/**
 * Run job extraction on page content
 */
async function handleExtractJobs(message) {
  const client = await getApiClient();
  const apiKeys = await Storage.get(STORAGE_KEYS.API_KEYS);
  
  if (!apiKeys.llmKey) {
    throw new Error('LLM API Key is missing. Configure it in Settings.');
  }

  const response = await client.extractJobs(
    message.pageContent,
    message.pageUrl,
    apiKeys.llmProvider,
    apiKeys.llmKey,
    apiKeys.llmModel
  );

  return { success: true, jobs: response.jobs };
}

/**
 * Generate cold email draft, querying ChromaDB portfolio links first
 */
async function handleGenerateEmail(message) {
  const client = await getApiClient();
  const apiKeys = await Storage.get(STORAGE_KEYS.API_KEYS);
  const userProfile = await Storage.get(STORAGE_KEYS.PROFILE);
  const promptConfig = await Storage.get(STORAGE_KEYS.PROMPT);
  
  if (!apiKeys.llmKey) {
    throw new Error('LLM API Key is missing. Configure it in Settings.');
  }

  const job = message.job;
  
  // 1. Query ChromaDB portfolio for matching links based on job skills
  let portfolioLinks = [];
  try {
    if (job.skills && job.skills.length > 0) {
      const queryRes = await client.queryPortfolio(job.skills, 2);
      if (queryRes.success && queryRes.links) {
        portfolioLinks = queryRes.links;
      }
    }
  } catch (err) {
    console.warn('[SW] Portfolio query failed. Proceeding without matching links:', err);
  }

  // Fallback: If no matches from DB, fetch default links from settings
  if (portfolioLinks.length === 0) {
    const attachments = await Storage.get(STORAGE_KEYS.ATTACHMENTS);
    if (attachments && attachments.portfolioLinks) {
      portfolioLinks = attachments.portfolioLinks.slice(0, 2);
    }
  }

  // 2. Generate email
  const response = await client.generateEmail(
    job,
    userProfile,
    portfolioLinks,
    message.tone || promptConfig.tone,
    message.instructions || promptConfig.instructions,
    promptConfig.mode === 'custom' ? promptConfig.customPrompt : null,
    apiKeys.llmProvider,
    apiKeys.llmKey,
    apiKeys.llmModel
  );

  return { 
    success: true, 
    subject: response.subject, 
    body: response.body,
    portfolioLinks: portfolioLinks
  };
}

/**
 * Send email via SMTP
 */
async function handleSendEmail(message) {
  const client = await getApiClient();
  const emailSettings = await Storage.get(STORAGE_KEYS.EMAIL);
  
  if (!emailSettings.address || !emailSettings.appPassword) {
    throw new Error('Gmail account settings are incomplete. Configure Gmail in Settings.');
  }

  const response = await client.sendEmail(
    message.toEmail,
    message.subject,
    message.body,
    emailSettings.address,
    emailSettings.appPassword,
    message.attachments || [],
    emailSettings.signature || ""
  );

  return { success: true, message: response.message };
}

/**
 * Send bulk emails with a queuing loop in the background
 */
async function handleSendAllBulk(message) {
  const client = await getApiClient();
  const emailSettings = await Storage.get(STORAGE_KEYS.EMAIL);
  const automation = await Storage.get(STORAGE_KEYS.AUTOMATION);
  
  if (!emailSettings.address || !emailSettings.appPassword) {
    throw new Error('Gmail account settings are incomplete. Configure Gmail in Settings.');
  }

  const jobsToProcess = message.jobs; // Array of job objects
  const delayMs = (automation.delaySeconds || 5) * 1000;
  
  // Background sending thread
  // We send progress updates to the active tab / sidepanel
  setTimeout(async () => {
    // Read history to mutate
    const history = await Storage.get(STORAGE_KEYS.JOB_HISTORY);
    const jobList = history && Array.isArray(history.jobs) ? history.jobs : [];

    for (let i = 0; i < jobsToProcess.length; i++) {
      const job = jobsToProcess[i];
      
      // Update state in storage to 'sending'
      updateJobStatusInList(jobList, job.id, 'sending');
      await Storage.set(STORAGE_KEYS.JOB_HISTORY, { ...history, jobs: jobList });
      notifyProgress(i + 1, jobsToProcess.length, job.company, 'sending');

      try {
        // Prepare attachments
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


        // Send request
        await client.sendEmail(
          job.email,
          job.emailSubject || `Regarding ${job.role} opportunity`,
          job.coldEmail,
          emailSettings.address,
          emailSettings.appPassword,
          attachments,
          emailSettings.signature
        );

        // Update state in storage to 'sent'
        updateJobStatusInList(jobList, job.id, 'sent', '');
        await Storage.set(STORAGE_KEYS.JOB_HISTORY, { ...history, jobs: jobList });
        notifyProgress(i + 1, jobsToProcess.length, job.company, 'sent');
        
      } catch (err) {
        console.error(`[SW] Bulk send failed for ${job.company}:`, err);
        updateJobStatusInList(jobList, job.id, 'failed', err.message);
        await Storage.set(STORAGE_KEYS.JOB_HISTORY, { ...history, jobs: jobList });
        notifyProgress(i + 1, jobsToProcess.length, job.company, 'failed', err.message);
      }

      // Delay between emails (except last)
      if (i < jobsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }, 100);

  return { success: true, message: 'Bulk sending pipeline started in background.' };
}

/**
 * Proxy job search requests to backend
 */
async function handleSearchJobs(message) {
  const client = await getApiClient();
  const apiKeys = await Storage.get(STORAGE_KEYS.API_KEYS);
  
  const response = await client.searchJobs(
    message.query,
    message.location || "",
    message.provider || "remoteok",
    message.apiKey || apiKeys.searchKey,
    message.page || 1
  );

  return { success: true, jobs: response.jobs };
}

// ============ HELPER FUNCTIONS ============

function updateJobStatusInList(jobList, id, status, errorMsg = '') {
  const job = jobList.find(j => j.id === id);
  if (job) {
    job.status = status;
    job.errorMessage = errorMsg;
    if (status === 'sent') {
      job.sentAt = new Date().toISOString();
    }
  }
}

function notifyProgress(current, total, company, status, error = '') {
  // Broadcast to sidepanel and popups
  chrome.runtime.sendMessage({
    type: 'SEND_ALL_PROGRESS',
    data: { current, total, company, status, error }
  }).catch(() => {}); // Catch error if receiver is closed
}

async function handleOpenSidePanel(sender) {
  if (sender.tab) {
    await chrome.sidePanel.open({ tabId: sender.tab.id });
  } else {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  }
  return { success: true };
}
