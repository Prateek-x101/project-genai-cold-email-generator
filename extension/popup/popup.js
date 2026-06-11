/**
 * ColdCraft AI — Popup Script
 * 
 * Handles quick-scraping, displaying connection status,
 * showing the last 3 scraped jobs, and quick navigation.
 */

// ============ DOM REFERENCES ============
const DOM = {
  connectionStatus: document.getElementById('connection-status'),
  scrapeBtn: document.getElementById('scrape-btn'),
  scrapeError: document.getElementById('scrape-error'),
  recentJobs: document.getElementById('recent-jobs'),
  openWorkspaceBtn: document.getElementById('open-workspace-btn'),
  openSettingsBtn: document.getElementById('open-settings-btn'),
};

// ============ INITIALIZE ============
document.addEventListener('DOMContentLoaded', async () => {
  await checkBackendHealth();
  await loadRecentJobs();

  // Bind events
  DOM.scrapeBtn.addEventListener('click', handleScrapeClick);
  DOM.openWorkspaceBtn.addEventListener('click', openWorkspace);
  DOM.openSettingsBtn.addEventListener('click', openSettings);
});

// ============ CHECK BACKEND HEALTH ============
async function checkBackendHealth() {
  try {
    DOM.connectionStatus.className = 'status-indicator pending';
    
    // Get backend URL from storage
    const backendUrl = await Storage.get(STORAGE_KEYS.BACKEND_URL);
    
    // Send health check message to background service worker
    const response = await chrome.runtime.sendMessage({ 
      type: 'CHECK_HEALTH', 
      backendUrl 
    });

    if (response && response.success) {
      DOM.connectionStatus.className = 'status-indicator ready';
      DOM.connectionStatus.title = 'Backend Online';
    } else {
      DOM.connectionStatus.className = 'status-indicator error';
      DOM.connectionStatus.title = response?.error || 'Backend Offline';
    }
  } catch (err) {
    console.error('[Popup] Health check error:', err);
    DOM.connectionStatus.className = 'status-indicator error';
    DOM.connectionStatus.title = 'Backend Offline';
  }
}

// ============ LOAD RECENT JOBS ============
async function loadRecentJobs() {
  try {
    const history = await Storage.get(STORAGE_KEYS.JOB_HISTORY);
    
    // The history object contains { jobs: [...], filter: 'all', selected: [...] }
    const jobs = (history && Array.isArray(history.jobs)) ? history.jobs : [];

    if (jobs.length === 0) {
      DOM.recentJobs.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <p>No jobs scraped yet.</p>
        </div>
      `;
      return;
    }

    // Sort by scrapedAt desc and take last 3
    const recent = [...jobs]
      .sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt))
      .slice(0, 3);

    DOM.recentJobs.innerHTML = '';
    
    recent.forEach(job => {
      const row = document.createElement('div');
      row.className = 'job-row';
      row.addEventListener('click', () => {
        openWorkspace();
      });

      const statusText = getStatusLabel(job.status);

      row.innerHTML = `
        <div class="job-meta">
          <div class="job-role">${escapeHtml(job.role || 'Unknown Role')}</div>
          <div class="job-company">${escapeHtml(job.company || 'Unknown Company')}</div>
        </div>
        <span class="status-badge ${getStatusClass(job.status)}">${statusText}</span>
      `;

      DOM.recentJobs.appendChild(row);
    });

  } catch (err) {
    console.error('[Popup] Failed to load recent jobs:', err);
  }
}

function getStatusLabel(status) {
  const labels = {
    scraped: 'Scraped',
    email_found: 'Email Found',
    email_generated: 'Generated',
    ready: 'Ready',
    sending: 'Sending',
    sent: 'Sent',
    failed: 'Failed',
  };
  return labels[status] || 'Scraped';
}

function getStatusClass(status) {
  const classes = {
    scraped: 'pending',
    email_found: 'pending',
    email_generated: 'pending',
    ready: 'ready',
    sending: 'sending',
    sent: 'sent',
    failed: 'error',
  };
  return classes[status] || 'pending';
}

// ============ SCRAPE ACTIVE PAGE ============
async function handleScrapeClick() {
  DOM.scrapeBtn.disabled = true;
  DOM.scrapeBtn.textContent = '⚡ Scraping page...';
  DOM.scrapeError.classList.add('hidden');

  try {
    // 1. Scrape the active tab's page content
    const response = await chrome.runtime.sendMessage({ type: 'SCRAPE_ACTIVE_PAGE' });

    if (response && response.success) {
      DOM.scrapeBtn.textContent = '🔍 Extracting jobs...';
      
      // 2. Call job extraction API in background worker
      const extractResponse = await chrome.runtime.sendMessage({
        type: 'EXTRACT_JOBS',
        pageContent: response.data.text,
        pageUrl: response.data.url
      });

      if (extractResponse && extractResponse.success) {
        const jobs = extractResponse.jobs;

        if (!jobs || jobs.length === 0) {
          showError('No job postings found on this page.');
          return;
        }

        // 3. Load current history, assign IDs and append new jobs
        const history = await Storage.get(STORAGE_KEYS.JOB_HISTORY);
        const jobList = (history && Array.isArray(history.jobs)) ? history.jobs : [];

        jobs.forEach(job => {
          job.id = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          job.scrapedAt = new Date().toISOString();
          job.status = 'scraped';
          
          // Basic fields check
          job.email = '';
          job.emailSource = 'none';
          job.emailConfidence = 'missing';
          job.coldEmail = '';
          job.coldEmailGenerated = false;
          
          jobList.push(job);
        });

        // Save back to storage history
        await Storage.set(STORAGE_KEYS.JOB_HISTORY, {
          jobs: jobList,
          filter: history?.filter || 'all',
          selected: history?.selected || [],
        });

        // 4. Open workspace sidepanel and close popup
        await openWorkspace();
        window.close();
      } else {
        showError(extractResponse?.error || 'Failed to extract jobs from page content.');
      }
    } else {
      showError(response?.error || 'Failed to read page content.');
    }
  } catch (err) {
    console.error('[Popup] Scrape click error:', err);
    showError(err.message || 'Could not establish connection. Make sure the page is fully loaded.');
  } finally {
    DOM.scrapeBtn.disabled = false;
    DOM.scrapeBtn.textContent = '⚡ Scrape Career Page';
  }
}

function showError(msg) {
  DOM.scrapeError.textContent = msg;
  DOM.scrapeError.classList.remove('hidden');
}

// ============ NAVIGATION ============
async function openWorkspace() {
  try {
    await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    window.close();
  } catch (err) {
    console.error('[Popup] Error opening side panel:', err);
  }
}

async function openSettings() {
  try {
    await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    window.close();
  } catch (err) {
    console.error('[Popup] Error opening options:', err);
  }
}

// ============ UTILITIES ============
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getDomainName(urlStr) {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.replace('www.', '');
    const parts = host.split('.');
    if (parts.length > 0) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return host;
  } catch {
    return '';
  }
}
