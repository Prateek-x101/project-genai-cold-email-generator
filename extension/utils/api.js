/**
 * ColdCraft AI — Backend API Client
 * 
 * Wrapper for all HTTP requests to the FastAPI backend.
 * Handles fetch timeouts, formats payloads, and normalizes errors.
 */

class ColdCraftAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.trim().replace(/\/docs\/?$/, '').replace(/\/+$/, '');
  }

  /**
   * Helper to perform POST requests with a timeout
   */
  async _post(path, body = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!res.ok) {
        let errorMsg = `Server error: ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.detail) {
            errorMsg = Array.isArray(errData.detail)
              ? errData.detail.map(d => d.msg).join(', ')
              : errData.detail;
          }
        } catch {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.success === false) {
        throw new Error(data.error || 'Server operation failed.');
      }
      return data;
    } catch (err) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Server might be waking up (on free tier). Please retry.');
      }
      throw err;
    }
  }

  /**
   * Helper to perform GET requests with a timeout
   */
  async _get(path, timeoutMs = 12000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new Error('Connection timed out.');
      }
      throw err;
    }
  }

  /**
   * Ping backend health check
   */
  async checkHealth() {
    return await this._get('/api/health');
  }

  /**
   * Extract job listings from raw scraped page content
   */
  async extractJobs(pageContent, pageUrl, provider, apiKey, modelName = null) {
    return await this._post('/api/extract-jobs', {
      page_content: pageContent,
      page_url: pageUrl,
      provider: provider,
      api_key: apiKey,
      model_name: modelName
    });
  }

  /**
   * Generate cold email draft
   */
  async generateEmail(job, userProfile, portfolioLinks, tone, instructions, customPrompt, provider, apiKey, modelName = null) {
    return await this._post('/api/generate-email', {
      job: {
        role: job.role,
        company: job.company,
        experience: job.experience || '',
        skills: job.skills || [],
        description: job.description || '',
        source_url: job.sourceUrl || ''
      },
      user_profile: {
        name: userProfile.name || '',
        company: userProfile.company || '',
        role: userProfile.role || '',
        bio: userProfile.bio || '',
        skills: userProfile.skills || ''
      },
      portfolio_links: portfolioLinks || [],
      tone: tone || 'professional',
      custom_instructions: instructions || '',
      custom_prompt: customPrompt || null,
      provider: provider,
      api_key: apiKey,
      model_name: modelName
    });
  }

  /**
   * Send single email via SMTP
   */
  async sendEmail(toEmail, subject, body, gmailAddress, gmailAppPassword, attachments = [], signature = "") {
    return await this._post('/api/send-email', {
      to_email: toEmail,
      subject: subject,
      body: body,
      gmail_address: gmailAddress,
      gmail_app_password: gmailAppPassword,
      attachments: attachments.map(a => ({ name: a.name, base64: a.base64 || '', url: a.url || null })),
      signature: signature || ""
    }, 90000); // 90s timeout — downloading attachments and SMTP sending can take time
  }

  /**
   * Discover contacts / emails
   */
  async findContacts(company, pageUrl = "", pageContent = "") {
    return await this._post('/api/find-contacts', {
      company: company,
      page_url: pageUrl,
      page_content: pageContent
    });
  }

  /**
   * Search jobs on external aggregators
   */
  async searchJobs(query, location = "", provider = "remoteok", apiKey = "", page = 1) {
    return await this._post('/api/search-jobs', {
      query: query,
      location: location,
      provider: provider,
      api_key: apiKey,
      page: page
    });
  }

  /**
   * Load tech stack mappings into ChromaDB
   */
  async loadPortfolio(items) {
    return await this._post('/api/portfolio/load', {
      items: items.map(item => ({
        techstack: item.techstack,
        links: item.links
      }))
    });
  }

  /**
   * Query skills mappings from ChromaDB
   */
  async queryPortfolio(skills, nResults = 2) {
    return await this._post('/api/portfolio/query', {
      skills: skills,
      n_results: nResults
    });
  }

  /**
   * Fetch available models for a given provider
   */
  async fetchModels(provider, apiKey) {
    return await this._post('/api/models', {
      provider: provider,
      api_key: apiKey
    });
  }

  /**
   * Verify Gmail SMTP credentials without sending any email
   */
  async verifySmtp(gmailAddress, appPassword) {
    return await this._post('/api/verify-smtp', {
      gmail_address: gmailAddress,
      gmail_app_password: appPassword
    }, 20000); // 20s timeout — SMTP connect can be slow
  }
}

// Export for extension modules
if (typeof window !== 'undefined') {
  window.ColdCraftAPI = ColdCraftAPI;
} else if (typeof self !== 'undefined') {
  self.ColdCraftAPI = ColdCraftAPI;
}
