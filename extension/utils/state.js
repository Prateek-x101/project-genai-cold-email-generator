/**
 * ColdCraft AI — Job List State Manager
 * 
 * In-memory state for the current session's job list.
 * Single source of truth — all UI reads from here, all mutations go through here.
 * Emits change events so UI can reactively update.
 */

const JobState = (() => {
  // ============ PRIVATE STATE ============
  let _jobs = [];
  let _filter = 'all'; // 'all' | 'ready' | 'pending' | 'sent' | 'failed'
  let _selected = new Set();
  let _listeners = [];
  let _nextId = 1;

  // ============ HELPERS ============

  /**
   * Generate a unique job ID
   */
  function generateId() {
    return `job_${Date.now()}_${_nextId++}`;
  }

  /**
   * Create a job object with all required fields (no missing fields ever)
   */
  function createJob(data = {}) {
    return {
      id: data.id || generateId(),
      role: data.role || '',
      company: data.company || '',
      experience: data.experience || '',
      description: data.description || '',
      skills: Array.isArray(data.skills) ? data.skills : [],
      sourceUrl: data.sourceUrl || '',

      // Email
      email: data.email || '',
      emailSource: data.emailSource || 'none', // 'page_content' | 'website_scrape' | 'pattern_guess' | 'user_input' | 'csv_import' | 'none'
      emailConfidence: data.emailConfidence || 'missing', // 'verified' | 'suggested' | 'missing'

      // Cold email
      coldEmail: data.coldEmail || '',
      coldEmailGenerated: data.coldEmailGenerated || false,
      emailSubject: data.emailSubject || '',

      // Attachments (null = use defaults from settings)
      overrideResume: data.overrideResume || null,       // { name, base64 } or null
      overridePortfolio: data.overridePortfolio || null,  // string[] or null
      overrideAttachments: data.overrideAttachments || null, // [{ name, base64 }] or null

      // Status
      status: data.status || 'scraped',
      errorMessage: data.errorMessage || '',
      sentAt: data.sentAt || null,

      // Metadata
      scrapedAt: data.scrapedAt || new Date().toISOString(),
    };
  }

  /**
   * Notify all listeners about state change
   */
  function notify(eventType, data) {
    for (const listener of _listeners) {
      try {
        listener({ type: eventType, data, jobs: _jobs, filter: _filter, selected: _selected });
      } catch (err) {
        console.error('[JobState] Listener error:', err);
      }
    }
  }

  /**
   * Determine the computed status based on what data is available
   */
  function computeStatus(job) {
    if (job.status === 'sent' || job.status === 'failed' || job.status === 'sending') {
      return job.status; // Terminal/active states — don't overwrite
    }
    if (job.email && job.coldEmail && job.coldEmailGenerated) return 'ready';
    if (job.email && job.coldEmailGenerated) return 'email_generated';
    if (job.email) return 'email_found';
    return 'scraped';
  }

  // ============ PUBLIC API ============
  return {

    // ---- READ ----

    /**
     * Get all jobs (with optional filter applied)
     */
    getJobs(applyFilter = true) {
      if (!applyFilter || _filter === 'all') return [..._jobs];

      return _jobs.filter(job => {
        switch (_filter) {
          case 'ready': return job.status === 'ready';
          case 'pending': return ['scraped', 'email_found', 'email_generated'].includes(job.status);
          case 'sent': return job.status === 'sent';
          case 'failed': return job.status === 'failed';
          default: return true;
        }
      });
    },

    /**
     * Get a single job by ID
     */
    getJob(id) {
      return _jobs.find(j => j.id === id) || null;
    },

    /**
     * Get all selected job IDs
     */
    getSelected() {
      return new Set(_selected);
    },

    /**
     * Get selected jobs that are ready to send
     */
    getSelectedReady() {
      return _jobs.filter(j => _selected.has(j.id) && j.status === 'ready');
    },

    /**
     * Get current filter
     */
    getFilter() {
      return _filter;
    },

    /**
     * Get stats (counts by status)
     */
    getStats() {
      const stats = {
        total: _jobs.length,
        scraped: 0,
        emailFound: 0,
        emailGenerated: 0,
        ready: 0,
        sending: 0,
        sent: 0,
        failed: 0,
        selected: _selected.size,
      };

      for (const job of _jobs) {
        switch (job.status) {
          case 'scraped': stats.scraped++; break;
          case 'email_found': stats.emailFound++; break;
          case 'email_generated': stats.emailGenerated++; break;
          case 'ready': stats.ready++; break;
          case 'sending': stats.sending++; break;
          case 'sent': stats.sent++; break;
          case 'failed': stats.failed++; break;
        }
      }

      stats.pending = stats.scraped + stats.emailFound + stats.emailGenerated;
      return stats;
    },

    // ---- WRITE ----

    /**
     * Add a single job
     */
    addJob(data) {
      const job = createJob(data);
      job.status = computeStatus(job);
      _jobs.push(job);
      notify('job_added', job);
      return job;
    },

    /**
     * Add multiple jobs at once
     */
    addJobs(dataArray) {
      const newJobs = dataArray.map(d => {
        const job = createJob(d);
        job.status = computeStatus(job);
        return job;
      });
      _jobs.push(...newJobs);
      notify('jobs_added', newJobs);
      return newJobs;
    },

    /**
     * Update a job by ID (partial update)
     */
    updateJob(id, updates) {
      const index = _jobs.findIndex(j => j.id === id);
      if (index === -1) {
        console.warn(`[JobState] Job not found: ${id}`);
        return null;
      }

      const job = { ..._jobs[index], ...updates };
      // Recompute status unless explicitly set in updates
      if (!updates.status) {
        job.status = computeStatus(job);
      }
      _jobs[index] = job;
      notify('job_updated', job);
      return job;
    },

    /**
     * Remove a job by ID
     */
    removeJob(id) {
      const index = _jobs.findIndex(j => j.id === id);
      if (index === -1) return false;

      const removed = _jobs.splice(index, 1)[0];
      _selected.delete(id);
      notify('job_removed', removed);
      return true;
    },

    /**
     * Clear all jobs
     */
    clearAll() {
      _jobs = [];
      _selected.clear();
      notify('jobs_cleared', null);
    },

    // ---- SELECTION ----

    toggleSelect(id) {
      if (_selected.has(id)) {
        _selected.delete(id);
      } else {
        _selected.add(id);
      }
      notify('selection_changed', { id, selected: _selected.has(id) });
    },

    selectAll() {
      const visibleJobs = this.getJobs(true);
      for (const job of visibleJobs) {
        _selected.add(job.id);
      }
      notify('selection_changed', { all: true });
    },

    deselectAll() {
      _selected.clear();
      notify('selection_changed', { all: false });
    },

    isSelected(id) {
      return _selected.has(id);
    },

    // ---- FILTER ----

    setFilter(filter) {
      _filter = filter;
      notify('filter_changed', filter);
    },

    // ---- BULK OPERATIONS ----

    /**
     * Mark a job as sending
     */
    markSending(id) {
      return this.updateJob(id, { status: 'sending' });
    },

    /**
     * Mark a job as sent
     */
    markSent(id) {
      return this.updateJob(id, {
        status: 'sent',
        sentAt: new Date().toISOString(),
        errorMessage: '',
      });
    },

    /**
     * Mark a job as failed
     */
    markFailed(id, errorMessage = '') {
      return this.updateJob(id, {
        status: 'failed',
        errorMessage,
      });
    },

    /**
     * Reset a failed job back to ready (for retry)
     */
    retryJob(id) {
      const job = this.getJob(id);
      if (job && job.status === 'failed') {
        return this.updateJob(id, {
          status: 'ready',
          errorMessage: '',
        });
      }
      return null;
    },

    // ---- EVENTS ----

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback: ({ type, data, jobs, filter, selected }) => void
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
      _listeners.push(listener);
      return () => {
        _listeners = _listeners.filter(l => l !== listener);
      };
    },

    // ---- SERIALIZATION ----

    /**
     * Export current state as plain object (for persistence or transfer)
     */
    serialize() {
      return {
        jobs: [..._jobs],
        filter: _filter,
        selected: [..._selected],
      };
    },

    /**
     * Restore state from serialized object
     */
    deserialize(data) {
      if (data && Array.isArray(data.jobs)) {
        _jobs = data.jobs.map(j => createJob(j));
        _filter = data.filter || 'all';
        _selected = new Set(data.selected || []);
        notify('state_restored', null);
      }
    },
  };
})();

// Export
if (typeof window !== 'undefined') {
  window.JobState = JobState;
}
