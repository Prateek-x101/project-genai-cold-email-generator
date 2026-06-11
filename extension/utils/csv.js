/**
 * ColdCraft AI — CSV Import & Export Utilities
 * 
 * Handles parsing custom filled CSV files with fuzzy matching column headers,
 * and compiling list arrays back to escaped CSV formats.
 */

const CSVUtils = {
  /**
   * Parse import CSV string and map rows to internal job schemas.
   * Fuzzy matches columns (e.g. "E-mail" -> "email")
   */
  parseImportCSV(csvText) {
    // Strip BOM
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    // Parse raw headers list
    const headers = this._parseLine(lines[0]).map(h => h.trim().toLowerCase());

    // Locate column indices
    const colIndices = {
      name: this._findColIndex(headers, ['name', 'contact', 'person']),
      company: this._findColIndex(headers, ['company', 'organization', 'org', 'employer']),
      role: this._findColIndex(headers, ['role', 'title', 'position', 'job title']),
      email: this._findColIndex(headers, ['email', 'e-mail', 'mail', 'email address']),
      url: this._findColIndex(headers, ['source url', 'url', 'career page url', 'career url', 'career page', 'job url']), // Removed 'link' to avoid conflict with portfolio Link column
      description: this._findColIndex(headers, ['description', 'job description', 'desc', 'jd']),
      coldEmail: this._findColIndex(headers, ['cold email', 'cold_email', 'email body', 'email text', 'message']),
    };

    // Find all header indices that match attachments
    const attachmentIndices = [];
    headers.forEach((header, index) => {
      if (header.includes('attachment') || header.includes('resume')) {
        attachmentIndices.push({ index, header });
      }
    });
    // Sort them: main attachment or resume first, then numbered ones
    attachmentIndices.sort((a, b) => {
      const isMainA = a.header === 'attachments' || a.header === 'attachment' || a.header === 'resume';
      const isMainB = b.header === 'attachments' || b.header === 'attachment' || b.header === 'resume';
      if (isMainA && !isMainB) return -1;
      if (!isMainA && isMainB) return 1;
      return a.index - b.index;
    });

    const linkIndex = this._findColIndex(headers, ['link', 'links', 'portfolio']);

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
      const values = this._parseLine(lines[i]);
      const getVal = (key) => {
        const idx = colIndices[key];
        return (idx !== -1 && idx < values.length) ? values[idx].trim() : '';
      };

      const company = getVal('company');
      const role = getVal('role');
      const email = getVal('email');
      const url = getVal('url');
      const description = getVal('description');
      const coldEmail = getVal('coldEmail');

      // Skip row if it does not contain useful data
      if (!company && !role && !email && !url && !description) {
        continue;
      }

      const hasEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const hasColdEmail = coldEmail.length > 20;

      // Attachments parsing
      let overrideResume = null;
      const overrideAttachments = [];
      attachmentIndices.forEach((item, idx) => {
        if (item.index < values.length) {
          const val = values[item.index].trim();
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

      // Link parsing (portfolio links)
      let overridePortfolio = null;
      if (linkIndex !== -1 && linkIndex < values.length) {
        const val = values[linkIndex].trim();
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
  },

  /**
   * Generates formatted CSV string from jobs list
   */
  exportToCSV(jobs) {
    if (!jobs || jobs.length === 0) return '';

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

    const lines = [
      headers.map(formatField).join(','),
      ...rows.map(row => row.map(formatField).join(','))
    ];

    return lines.join('\n');
  },

  /**
   * Helper to parse a single CSV line with quote cell-support
   */
  _parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped double quote
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
  },

  /**
   * Helper to search header column matches using strict and fuzzy aliases
   */
  _findColIndex(headers, aliases) {
    // Try exact matches first
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx !== -1) return idx;
    }
    // Try partial contains matches
    for (const alias of aliases) {
      const idx = headers.findIndex(h => h.includes(alias));
      if (idx !== -1) return idx;
    }
    return -1;
  }
};

// Export
if (typeof window !== 'undefined') {
  window.CSVUtils = CSVUtils;
}
