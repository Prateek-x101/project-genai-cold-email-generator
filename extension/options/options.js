/**
 * ColdCraft AI — Options JavaScript
 * 
 * Binds HTML input fields to Chrome storage, handles validation,
 * dynamic portfolio link fields, file uploads (Base64 encoding),
 * settings export/import, and testing connections to backend.
 */

// ============ DOM REFERENCES ============
const DOM = {
  // Sidebar Tabs
  navItems: document.querySelectorAll('.nav-item'),
  panels: document.querySelectorAll('.settings-panel'),

  // Header
  backendStatus: document.getElementById('backend-status'),
  saveAllBtn: document.getElementById('save-all-btn'),

  // Profile Panel
  profileName: document.getElementById('profile-name'),
  profileRole: document.getElementById('profile-role'),
  profileCompany: document.getElementById('profile-company'),
  profileBio: document.getElementById('profile-bio'),
  profileSkills: document.getElementById('profile-skills'),

  // API Panel
  llmProvider: document.getElementById('api-llm-provider'),
  llmKey: document.getElementById('api-llm-key'),
  llmKeyHint: document.getElementById('llm-key-hint'),
  llmModel: document.getElementById('api-llm-model'),
  fetchModelsBtn: document.getElementById('fetch-models-btn'),
  searchProvider: document.getElementById('api-search-provider'),
  searchKey: document.getElementById('api-search-key'),
  searchKeyHint: document.getElementById('search-key-hint'),
  testConnBtn: document.getElementById('test-connection-btn'),

  // Email Panel
  emailAddress: document.getElementById('email-address'),
  emailPassword: document.getElementById('email-password'),
  emailSignature: document.getElementById('email-signature'),

  // Attachments Panel
  resumeDropzone: document.getElementById('resume-dropzone'),
  resumeInput: document.getElementById('resume-input'),
  resumeStatus: document.getElementById('resume-status'),
  resumeNameDisplay: document.getElementById('resume-name-display'),
  removeResumeBtn: document.getElementById('remove-resume-btn'),
  portfolioContainer: document.getElementById('portfolio-links-container'),
  addPortfolioBtn: document.getElementById('add-portfolio-btn'),
  attachmentsDropzone: document.getElementById('attachments-dropzone'),
  attachmentsInput: document.getElementById('attachments-input'),
  otherFilesContainer: document.getElementById('other-files-container'),

  // Prompt Panel
  btnModeEmbedded: document.getElementById('btn-mode-embedded'),
  btnModeCustom: document.getElementById('btn-mode-custom'),
  embeddedFields: document.getElementById('embedded-fields'),
  customFields: document.getElementById('custom-fields'),
  promptTone: document.getElementById('prompt-tone'),
  toneDescDisplay: document.getElementById('tone-desc-display'),
  promptInstructions: document.getElementById('prompt-instructions'),
  promptCustomText: document.getElementById('prompt-custom-text'),
  resetPromptBtn: document.getElementById('reset-prompt-btn'),

  // Automation Panel
  toggleAutoSend: document.getElementById('toggle-auto-send'),
  autoDelay: document.getElementById('auto-delay'),
  autoLimit: document.getElementById('auto-limit'),

  // System Panel
  exportSettingsBtn: document.getElementById('export-settings-btn'),
  importTriggerBtn: document.getElementById('import-trigger-btn'),
  importSettingsInput: document.getElementById('import-settings-input'),
  backendUrl: document.getElementById('backend-url'),
  resetAllBtn: document.getElementById('reset-all-btn'),

  // Confirm Modal
  confirmOverlay: document.getElementById('confirm-modal-overlay'),
  confirmTitle: document.getElementById('confirm-modal-title'),
  confirmMessage: document.getElementById('confirm-modal-message'),
  confirmCancel: document.getElementById('confirm-cancel-btn'),
  confirmOk: document.getElementById('confirm-ok-btn'),
  confirmClose: document.getElementById('confirm-modal-close'),

  // Toasts
  toastContainer: document.getElementById('toast-container'),
};

// ============ IN-MEMORY ATTACHMENTS STATE ============
// Files are large; we store them in memory as Base64 while the user interacts, then save to Chrome storage.
let attachmentsState = {
  resumeBase64: '',
  resumeName: '',
  portfolioLinks: [],
  otherFiles: [], // Array of { name, base64 }
};

let currentPromptMode = 'embedded';

// ============ INITIALIZE ============
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initPasswordToggles();
  initSelectOptions();
  await loadAllSettings();
  await checkBackendHealth();
  initEventListeners();
});

// ============ TAB NAVIGATION ============
function initTabs() {
  DOM.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');

      // Update active nav item
      DOM.navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Update visible panel
      DOM.panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `panel-${tabId}`) {
          panel.classList.add('active');
        }
      });

      // Update hash in URL
      window.location.hash = tabId;
    });
  });

  // Handle URL hash on load
  const hash = window.location.hash.substring(1);
  if (hash) {
    const matchingTab = document.querySelector(`.nav-item[data-tab="${hash}"]`);
    if (matchingTab) matchingTab.click();
  }
}

// ============ PASSWORD TOGGLES ============
function initPasswordToggles() {
  document.querySelectorAll('.toggle-password-btn').forEach(btn => {
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
}

// ============ SELECT & PRESENTS OPTIONS ============
function initSelectOptions() {
  // Populate LLM providers
  DOM.llmProvider.innerHTML = LLM_PROVIDERS.map(p => 
    `<option value="${p.value}">${p.label}</option>`
  ).join('');

  DOM.llmProvider.addEventListener('change', () => updateApiKeyHints());

  // Populate Search providers
  DOM.searchProvider.innerHTML = SEARCH_PROVIDERS.map(p => 
    `<option value="${p.value}">${p.label}</option>`
  ).join('');

  DOM.searchProvider.addEventListener('change', () => updateApiKeyHints());

  // Populate Tones
  DOM.promptTone.innerHTML = TONE_OPTIONS.map(t => 
    `<option value="${t.value}">${t.label}</option>`
  ).join('');

  DOM.promptTone.addEventListener('change', () => {
    const selectedTone = TONE_OPTIONS.find(t => t.value === DOM.promptTone.value);
    DOM.toneDescDisplay.textContent = selectedTone ? selectedTone.description : '';
  });

  // Populate Delays
  DOM.autoDelay.innerHTML = DELAY_OPTIONS.map(d => 
    `<option value="${d.value}">${d.label}</option>`
  ).join('');

  updateApiKeyHints();
}

function updateApiKeyHints() {
  const llm = LLM_PROVIDERS.find(p => p.value === DOM.llmProvider.value);
  DOM.llmKeyHint.innerHTML = llm ? llm.hint : '';

  const search = SEARCH_PROVIDERS.find(p => p.value === DOM.searchProvider.value);
  DOM.searchKeyHint.innerHTML = search ? search.hint : '';
}

// ============ LOAD ALL SETTINGS ============
async function loadAllSettings() {
  try {
    // 1. Profile
    const profile = await Storage.get(STORAGE_KEYS.PROFILE);
    DOM.profileName.value = profile.name || '';
    DOM.profileRole.value = profile.role || '';
    DOM.profileCompany.value = profile.company || '';
    DOM.profileBio.value = profile.bio || '';
    DOM.profileSkills.value = profile.skills || '';

    // 2. API Keys
    const apiKeys = await Storage.get(STORAGE_KEYS.API_KEYS);
    DOM.llmProvider.value = apiKeys.llmProvider || 'groq';
    DOM.llmKey.value = apiKeys.llmKey || '';
    const activeModel = apiKeys.llmModel || 'llama-3.3-70b-versatile';
    DOM.llmModel.innerHTML = `<option value="${activeModel}">${activeModel}</option>`;
    DOM.searchProvider.value = apiKeys.searchProvider || 'jsearch';
    DOM.searchKey.value = apiKeys.searchKey || '';
    updateApiKeyHints();

    // 3. Email Settings
    const email = await Storage.get(STORAGE_KEYS.EMAIL);
    DOM.emailAddress.value = email.address || '';
    DOM.emailPassword.value = email.appPassword || '';
    DOM.emailSignature.value = email.signature || '';

    // 4. Attachments
    const attachments = await Storage.get(STORAGE_KEYS.ATTACHMENTS);
    attachmentsState = { ...attachmentsState, ...attachments };
    renderResumeStatus();
    renderPortfolioLinks();
    renderOtherFilesChips();

    // 5. Prompt Settings
    const prompt = await Storage.get(STORAGE_KEYS.PROMPT);
    currentPromptMode = prompt.mode || 'embedded';
    DOM.promptTone.value = prompt.tone || 'professional';
    DOM.promptInstructions.value = prompt.instructions || '';
    DOM.promptCustomText.value = prompt.customPrompt || DEFAULT_SYSTEM_PROMPT;
    updatePromptModeUI();

    // Trigger tone description update
    DOM.promptTone.dispatchEvent(new Event('change'));

    // 6. Automation
    const automation = await Storage.get(STORAGE_KEYS.AUTOMATION);
    if (automation.autoSend) {
      DOM.toggleAutoSend.classList.add('active');
    } else {
      DOM.toggleAutoSend.classList.remove('active');
    }
    DOM.autoDelay.value = automation.delaySeconds || 5;
    DOM.autoLimit.value = automation.sendLimit || 50;

    // 7. Backend URL
    const backendUrl = await Storage.get(STORAGE_KEYS.BACKEND_URL);
    DOM.backendUrl.value = backendUrl || 'http://localhost:8000';

  } catch (error) {
    console.error('[Options] Error loading settings:', error);
    showToast('Failed to load some settings.', 'error');
  }
}

// ============ SAVE ALL SETTINGS ============
async function saveAllSettings() {
  try {
    // Validate email format if provided
    if (DOM.emailAddress.value && !VALIDATORS.email(DOM.emailAddress.value)) {
      showToast('Please enter a valid Gmail address.', 'error');
      DOM.emailAddress.focus();
      return;
    }

    // Validate backend URL format
    if (DOM.backendUrl.value && !VALIDATORS.url(DOM.backendUrl.value)) {
      showToast('Please enter a valid backend URL.', 'error');
      DOM.backendUrl.focus();
      return;
    }

    // Read portfolio links from DOM
    const linkInputs = DOM.portfolioContainer.querySelectorAll('.portfolio-link-input');
    attachmentsState.portfolioLinks = Array.from(linkInputs)
      .map(input => input.value.trim())
      .filter(link => link.length > 0);

    // Validate portfolio links
    for (const link of attachmentsState.portfolioLinks) {
      if (!VALIDATORS.url(link)) {
        showToast(`Invalid portfolio link URL: ${link}`, 'error');
        return;
      }
    }

    // 1. Save Profile
    await Storage.set(STORAGE_KEYS.PROFILE, {
      name: DOM.profileName.value.trim(),
      role: DOM.profileRole.value.trim(),
      company: DOM.profileCompany.value.trim(),
      bio: DOM.profileBio.value.trim(),
      skills: DOM.profileSkills.value.trim(),
    });

    // 2. Save API Keys
    await Storage.set(STORAGE_KEYS.API_KEYS, {
      llmProvider: DOM.llmProvider.value,
      llmKey: DOM.llmKey.value.trim(),
      llmModel: DOM.llmModel.value,
      searchProvider: DOM.searchProvider.value,
      searchKey: DOM.searchKey.value.trim(),
    });

    // 3. Save Email settings
    await Storage.set(STORAGE_KEYS.EMAIL, {
      address: DOM.emailAddress.value.trim(),
      appPassword: DOM.emailPassword.value.trim(),
      signature: DOM.emailSignature.value,
    });

    // 4. Save Attachments
    await Storage.set(STORAGE_KEYS.ATTACHMENTS, attachmentsState);

    // 5. Save Prompt Settings
    await Storage.set(STORAGE_KEYS.PROMPT, {
      mode: currentPromptMode,
      tone: DOM.promptTone.value,
      instructions: DOM.promptInstructions.value.trim(),
      customPrompt: DOM.promptCustomText.value.trim(),
    });

    // 6. Save Automation Settings
    await Storage.set(STORAGE_KEYS.AUTOMATION, {
      autoSend: DOM.toggleAutoSend.classList.contains('active'),
      delaySeconds: parseInt(DOM.autoDelay.value, 10),
      sendLimit: parseInt(DOM.autoLimit.value, 10) || 50,
    });

    // 7. Save Backend URL
    await Storage.set(STORAGE_KEYS.BACKEND_URL, DOM.backendUrl.value.trim());

    // Sync portfolio links to ChromaDB database in background
    const baseUrl = DOM.backendUrl.value.trim() || 'http://localhost:8000';
    const api = new ColdCraftAPI(baseUrl);
    const skillsText = DOM.profileSkills.value.trim();
    
    const portfolioItems = attachmentsState.portfolioLinks.map(link => {
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
        console.log('[Options] Portfolio links synced to ChromaDB!');
      } catch (err) {
        console.warn('[Options] ChromaDB portfolio sync failed:', err);
      }
    }

    showToast('All settings saved successfully!', 'success');
    
    // Refresh backend status checks
    await checkBackendHealth();

  } catch (error) {
    console.error('[Options] Save error:', error);
    showToast(`Error saving settings: ${error.message}`, 'error');
  }
}

// ============ ATTACHMENTS MANAGEMENT ============
function renderResumeStatus() {
  if (attachmentsState.resumeName && attachmentsState.resumeBase64) {
    DOM.resumeDropzone.classList.add('hidden');
    DOM.resumeStatus.classList.remove('hidden');
    DOM.resumeNameDisplay.textContent = attachmentsState.resumeName;
  } else {
    DOM.resumeDropzone.classList.remove('hidden');
    DOM.resumeStatus.classList.add('hidden');
    DOM.resumeNameDisplay.textContent = '';
  }
}

function handleResumeFile(file) {
  if (!file) return;

  if (file.type !== 'application/pdf') {
    showToast('Only PDF files are supported for resumes.', 'error');
    return;
  }

  if (file.size > FILE_LIMITS.RESUME_MAX_BYTES) {
    showToast('Resume file size exceeds the 5MB limit.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    attachmentsState.resumeBase64 = e.target.result;
    attachmentsState.resumeName = file.name;
    renderResumeStatus();
    showToast('Resume loaded (Click Save to apply changes).', 'info');
  };
  reader.readAsDataURL(file);
}

function renderPortfolioLinks() {
  DOM.portfolioContainer.innerHTML = '';
  const links = attachmentsState.portfolioLinks || [];
  
  if (links.length === 0) {
    addPortfolioLinkRow('');
  } else {
    links.forEach(link => addPortfolioLinkRow(link));
  }
}

function addPortfolioLinkRow(val = '') {
  const row = document.createElement('div');
  row.className = 'portfolio-link-row';
  row.innerHTML = `
    <input class="form-input portfolio-link-input" type="url" placeholder="https://myproject.com or github.com/username" value="${val}">
    <button type="button" class="btn btn-sm btn-danger remove-portfolio-row-btn">×</button>
  `;

  row.querySelector('.remove-portfolio-row-btn').addEventListener('click', () => {
    row.remove();
    // If empty list, add an empty row back
    if (DOM.portfolioContainer.children.length === 0) {
      addPortfolioLinkRow('');
    }
  });

  DOM.portfolioContainer.appendChild(row);
}

// Support other attachments
function handleOtherFile(file) {
  if (!file) return;

  if (file.size > FILE_LIMITS.ATTACHMENT_MAX_BYTES) {
    showToast(`File "${file.name}" exceeds the 5MB limit.`, 'error');
    return;
  }

  // Check total storage size of current files + new file to avoid Chrome storage limit crashes
  const reader = new FileReader();
  reader.onload = function(e) {
    attachmentsState.otherFiles.push({
      name: file.name,
      base64: e.target.result
    });
    renderOtherFilesChips();
  };
  reader.readAsDataURL(file);
}

function renderOtherFilesChips() {
  DOM.otherFilesContainer.innerHTML = '';
  const files = attachmentsState.otherFiles || [];

  files.forEach((file, index) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `
      <span>${file.name}</span>
      <span class="remove" data-index="${index}">×</span>
    `;

    chip.querySelector('.remove').addEventListener('click', () => {
      attachmentsState.otherFiles.splice(index, 1);
      renderOtherFilesChips();
    });

    DOM.otherFilesContainer.appendChild(chip);
  });
}

// ============ PROMPT CONFIG NAVIGATION ============
function updatePromptModeUI() {
  if (currentPromptMode === 'embedded') {
    DOM.btnModeEmbedded.classList.add('active');
    DOM.btnModeCustom.classList.remove('active');
    DOM.embeddedFields.classList.remove('hidden');
    DOM.customFields.classList.add('hidden');
  } else {
    DOM.btnModeEmbedded.classList.remove('active');
    DOM.btnModeCustom.classList.add('active');
    DOM.embeddedFields.classList.add('hidden');
    DOM.customFields.classList.remove('hidden');
  }
}

// ============ HEALTH STATUS ============
async function checkBackendHealth() {
  const baseUrl = DOM.backendUrl.value.trim().replace(/\/docs\/?$/, '').replace(/\/+$/, '') || 'http://localhost:8000';
  
  try {
    DOM.backendStatus.className = 'status-badge pending';
    DOM.backendStatus.querySelector('.status-text').textContent = 'Connecting...';
    
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      DOM.backendStatus.className = 'status-badge ready';
      DOM.backendStatus.querySelector('.status-text').textContent = 'Backend Online';
    } else {
      throw new Error('Server returned non-200');
    }
  } catch (err) {
    console.warn('[Options] Backend offline:', err);
    DOM.backendStatus.className = 'status-badge error';
    DOM.backendStatus.querySelector('.status-text').textContent = 'Backend Offline';
  }
}

// ============ EVENT LISTENERS ============
function initEventListeners() {
  // Save all
  DOM.saveAllBtn.addEventListener('click', saveAllSettings);

  // Connection testing
  DOM.testConnBtn.addEventListener('click', async () => {
    DOM.testConnBtn.disabled = true;
    DOM.testConnBtn.textContent = '🔄 Testing Connection...';
    await checkBackendHealth();
    DOM.testConnBtn.disabled = false;
    DOM.testConnBtn.textContent = '⚡ Test Connection to Server';
    if (DOM.backendStatus.classList.contains('ready')) {
      showToast('Connection Successful! Backend is online.', 'success');
    } else {
      showToast('Failed to connect to backend server.', 'error');
    }
  });

  // Fetch models button
  DOM.fetchModelsBtn.addEventListener('click', async () => {
    const provider = DOM.llmProvider.value;
    const apiKey = DOM.llmKey.value.trim();
    const baseUrl = DOM.backendUrl.value.trim().replace(/\/docs\/?$/, '').replace(/\/+$/, '') || 'http://localhost:8000';
    
    if (!apiKey) {
      showToast('Please enter an LLM API Key first.', 'warning');
      DOM.llmKey.focus();
      return;
    }

    DOM.fetchModelsBtn.disabled = true;
    DOM.fetchModelsBtn.textContent = '🔄 Fetching...';

    try {
      const apiClient = new ColdCraftAPI(baseUrl);
      const data = await apiClient.fetchModels(provider, apiKey);
      if (data && data.success && data.models) {
        DOM.llmModel.innerHTML = '';
        data.models.forEach(model => {
          const opt = document.createElement('option');
          opt.value = model;
          opt.textContent = model;
          DOM.llmModel.appendChild(opt);
        });
        showToast(`Successfully fetched ${data.models.length} models!`, 'success');
      } else {
        throw new Error(data.error || 'Failed to retrieve models list.');
      }
    } catch (err) {
      showToast('Fetch Models failed: ' + err.message, 'error');
    } finally {
      DOM.fetchModelsBtn.disabled = false;
      DOM.fetchModelsBtn.textContent = '🔄 Fetch Models';
    }
  });

  // Resume attachment dropzones
  DOM.resumeDropzone.addEventListener('click', () => DOM.resumeInput.click());
  DOM.resumeInput.addEventListener('change', (e) => {
    handleResumeFile(e.target.files[0]);
  });

  // Resume drag & drop
  DOM.resumeDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.resumeDropzone.style.background = 'var(--accent-yellow-light)';
  });
  DOM.resumeDropzone.addEventListener('dragleave', () => {
    DOM.resumeDropzone.style.background = 'var(--bg-input)';
  });
  DOM.resumeDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.resumeDropzone.style.background = 'var(--bg-input)';
    handleResumeFile(e.dataTransfer.files[0]);
  });

  DOM.removeResumeBtn.addEventListener('click', () => {
    attachmentsState.resumeBase64 = '';
    attachmentsState.resumeName = '';
    renderResumeStatus();
    showToast('Resume removed (Click Save to apply changes).', 'info');
  });

  // Portfolio Links Addition
  DOM.addPortfolioBtn.addEventListener('click', () => addPortfolioLinkRow(''));

  // Other attachments dropzones
  DOM.attachmentsDropzone.addEventListener('click', () => DOM.attachmentsInput.click());
  DOM.attachmentsInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => handleOtherFile(file));
  });

  // Drag & drop other attachments
  DOM.attachmentsDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.attachmentsDropzone.style.background = 'var(--accent-yellow-light)';
  });
  DOM.attachmentsDropzone.addEventListener('dragleave', () => {
    DOM.attachmentsDropzone.style.background = 'var(--bg-input)';
  });
  DOM.attachmentsDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.attachmentsDropzone.style.background = 'var(--bg-input)';
    Array.from(e.dataTransfer.files).forEach(file => handleOtherFile(file));
  });

  // Prompt Configuration Toggles
  DOM.btnModeEmbedded.addEventListener('click', () => {
    currentPromptMode = 'embedded';
    updatePromptModeUI();
  });
  DOM.btnModeCustom.addEventListener('click', () => {
    currentPromptMode = 'custom';
    updatePromptModeUI();
  });

  DOM.resetPromptBtn.addEventListener('click', () => {
    showConfirm('Reset Custom Prompt', 'Are you sure you want to overwrite your custom prompt with the default template?', () => {
      DOM.promptCustomText.value = DEFAULT_SYSTEM_PROMPT;
      showToast('Prompt reset to default template text.', 'info');
    });
  });

  // Automation Auto-Send Toggle
  DOM.toggleAutoSend.addEventListener('click', () => {
    DOM.toggleAutoSend.classList.toggle('active');
  });

  // System actions: Export
  DOM.exportSettingsBtn.addEventListener('click', async () => {
    try {
      const dataStr = await Storage.exportSettings();
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `coldcraft_settings_backup_${new Date().toISOString().slice(0,10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      showToast('Settings exported successfully!', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  });

  // System actions: Import
  DOM.importTriggerBtn.addEventListener('click', () => DOM.importSettingsInput.click());
  DOM.importSettingsInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
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

  // System actions: Reset All
  DOM.resetAllBtn.addEventListener('click', () => {
    showConfirm(
      'FACTORY RESET', 
      'WARNING: This will wipe out all API keys, your email credentials, and profile. This action cannot be undone. Are you absolutely sure?', 
      async () => {
        const success = await Storage.resetAll();
        if (success) {
          showToast('Factory reset complete. Reloading options...', 'success');
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    );
  });
}

// ============ DIALOG/CONFIRM MODAL ============
function showConfirm(title, message, onConfirm) {
  DOM.confirmTitle.textContent = title;
  DOM.confirmMessage.textContent = message;
  DOM.confirmOverlay.classList.remove('hidden');

  const cleanListeners = () => {
    DOM.confirmOk.replaceWith(DOM.confirmOk.cloneNode(true));
    DOM.confirmCancel.replaceWith(DOM.confirmCancel.cloneNode(true));
    DOM.confirmClose.replaceWith(DOM.confirmClose.cloneNode(true));
    
    // Re-assign references
    DOM.confirmOk = document.getElementById('confirm-ok-btn');
    DOM.confirmCancel = document.getElementById('confirm-cancel-btn');
    DOM.confirmClose = document.getElementById('confirm-modal-close');
  };

  DOM.confirmCancel.addEventListener('click', () => {
    DOM.confirmOverlay.classList.add('hidden');
    cleanListeners();
  });

  DOM.confirmClose.addEventListener('click', () => {
    DOM.confirmOverlay.classList.add('hidden');
    cleanListeners();
  });

  DOM.confirmOk.addEventListener('click', () => {
    DOM.confirmOverlay.classList.add('hidden');
    onConfirm();
    cleanListeners();
  });
}

// ============ TOASTS ============
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
    <span class="toast-close">×</span>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  DOM.toastContainer.appendChild(toast);

  // Auto-remove toast
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => toast.remove(), 200);
    }
  }, 4000);
}
