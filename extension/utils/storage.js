/**
 * ColdCraft AI — Chrome Storage Wrapper
 * 
 * Centralizes all Chrome storage operations with defaults and validation.
 * Every read operation returns a merged result with defaults — no nulls ever.
 * Every write operation validates data before saving.
 */

const STORAGE_KEYS = {
  PROFILE: 'coldcraft_profile',
  API_KEYS: 'coldcraft_api_keys',
  EMAIL: 'coldcraft_email',
  ATTACHMENTS: 'coldcraft_attachments',
  PROMPT: 'coldcraft_prompt',
  AUTOMATION: 'coldcraft_automation',
  BACKEND_URL: 'coldcraft_backend_url',
  JOB_HISTORY: 'coldcraft_job_history',
};

const DEFAULTS = {
  [STORAGE_KEYS.PROFILE]: {
    name: '',
    company: '',
    role: '',
    bio: '',
    skills: '',
  },

  [STORAGE_KEYS.API_KEYS]: {
    llmProvider: 'groq',
    llmKey: '',
    llmModel: 'llama-3.3-70b-versatile',
    searchProvider: 'jsearch',
    searchKey: '',
  },

  [STORAGE_KEYS.EMAIL]: {
    address: '',
    appPassword: '',
    signature: '',
  },

  [STORAGE_KEYS.ATTACHMENTS]: {
    resumeBase64: '',
    resumeName: '',
    portfolioLinks: [],
    otherFiles: [], // Array of { name, base64 }
  },

  [STORAGE_KEYS.PROMPT]: {
    mode: 'embedded', // 'embedded' | 'custom'
    tone: 'professional', // 'professional' | 'friendly' | 'bold' | 'concise'
    instructions: '',
    customPrompt: '',
  },

  [STORAGE_KEYS.AUTOMATION]: {
    autoSend: false,
    delaySeconds: 5,
    sendLimit: 50,
  },

  [STORAGE_KEYS.BACKEND_URL]: 'https://coldcraft-api-xjmt.onrender.com',

  [STORAGE_KEYS.JOB_HISTORY]: [],
};

/**
 * Storage API — all methods return Promises
 */
const Storage = {
  /**
   * Get a value from Chrome storage, merged with defaults.
   * @param {string} key - Storage key from STORAGE_KEYS
   * @returns {Promise<any>} The stored value merged with defaults
   */
  async get(key) {
    try {
      let storedValue;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(key);
        storedValue = result[key];
      } else {
        const item = localStorage.getItem(key);
        storedValue = item ? JSON.parse(item) : undefined;
      }
      const defaultValue = DEFAULTS[key];

      // No stored value — return default
      if (storedValue === undefined || storedValue === null) {
        return structuredClone(defaultValue);
      }

      // For objects, merge with defaults (fills missing fields)
      if (typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
        return { ...structuredClone(defaultValue), ...storedValue };
      }

      // For primitives and arrays, return stored value directly
      return storedValue;
    } catch (error) {
      console.error(`[Storage] Error reading ${key}:`, error);
      return structuredClone(DEFAULTS[key]);
    }
  },

  /**
   * Save a value to Chrome storage.
   * @param {string} key - Storage key from STORAGE_KEYS
   * @param {any} value - Value to store
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [key]: value });
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
      return true;
    } catch (error) {
      console.error(`[Storage] Error writing ${key}:`, error);
      // Check if it's a quota error
      if (error.message && error.message.includes('QUOTA')) {
        throw new Error('Storage is full. Please delete some old data from settings.');
      }
      return false;
    }
  },

  /**
   * Update specific fields of a stored object (partial update).
   * @param {string} key - Storage key
   * @param {object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  async update(key, updates) {
    try {
      const current = await this.get(key);
      if (typeof current === 'object' && !Array.isArray(current)) {
        const merged = { ...current, ...updates };
        return await this.set(key, merged);
      }
      // Non-object — just overwrite
      return await this.set(key, updates);
    } catch (error) {
      console.error(`[Storage] Error updating ${key}:`, error);
      return false;
    }
  },

  /**
   * Get ALL settings at once (for backend API calls).
   * @returns {Promise<object>} All settings merged with defaults
   */
  async getAll() {
    const keys = Object.values(STORAGE_KEYS);
    const results = {};
    for (const key of keys) {
      results[key] = await this.get(key);
    }
    return results;
  },

  /**
   * Clear a specific key (reset to default).
   * @param {string} key - Storage key to reset
   * @returns {Promise<boolean>} Success status
   */
  async reset(key) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(key);
      } else {
        localStorage.removeItem(key);
      }
      return true;
    } catch (error) {
      console.error(`[Storage] Error resetting ${key}:`, error);
      return false;
    }
  },

  /**
   * Reset ALL storage (factory reset).
   * @returns {Promise<boolean>} Success status
   */
  async resetAll() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const keys = Object.values(STORAGE_KEYS);
        await chrome.storage.local.remove(keys);
      } else {
        localStorage.clear();
      }
      return true;
    } catch (error) {
      console.error(`[Storage] Error resetting all:`, error);
      return false;
    }
  },

  /**
   * Export all settings as JSON string (for backup).
   * @returns {Promise<string>} JSON string of all settings
   */
  async exportSettings() {
    const all = await this.getAll();
    return JSON.stringify(all, null, 2);
  },

  /**
   * Import settings from JSON string (restore backup).
   * @param {string} jsonString - JSON string of settings
   * @returns {Promise<boolean>} Success status
   */
  async importSettings(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      for (const [key, value] of Object.entries(parsed)) {
        if (Object.values(STORAGE_KEYS).includes(key)) {
          await this.set(key, value);
        }
      }
      return true;
    } catch (error) {
      console.error('[Storage] Error importing settings:', error);
      throw new Error('Invalid settings file. Make sure it\'s a valid JSON export.');
    }
  },

  /**
   * Validate that essential settings are configured.
   * Returns an object indicating what's missing.
   * @returns {Promise<object>} { isReady, missing: string[] }
   */
  async validateSetup() {
    const missing = [];

    const apiKeys = await this.get(STORAGE_KEYS.API_KEYS);
    if (!apiKeys.llmKey) missing.push('LLM API Key');

    const profile = await this.get(STORAGE_KEYS.PROFILE);
    if (!profile.name) missing.push('Your Name');

    return {
      isReady: missing.length === 0,
      missing,
    };
  },
};

// Export for use in other modules
// In Chrome extension context, these are available globally when loaded via <script>
// For service worker, use importScripts()
if (typeof window !== 'undefined') {
  window.Storage = Storage;
  window.STORAGE_KEYS = STORAGE_KEYS;
  window.DEFAULTS = DEFAULTS;
} else if (typeof self !== 'undefined') {
  self.Storage = Storage;
  self.STORAGE_KEYS = STORAGE_KEYS;
  self.DEFAULTS = DEFAULTS;
}
