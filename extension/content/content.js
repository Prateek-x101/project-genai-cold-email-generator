/**
 * ColdCraft AI — Content Script (Placeholder)
 * 
 * Injected into every page. In Module 1, this only registers with
 * the service worker. Full scraping logic is added in Module 3.
 * 
 * Listens for messages from the service worker to scrape page content.
 */

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    try {
      const content = extractPageContent();
      sendResponse({ success: true, data: content });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep message channel open for async response
  }
});

/**
 * Extract text content from the current page.
 * Attempts to find the main content area, falling back to body.
 * Strips navigation, footer, scripts, and other non-content elements.
 */
function extractPageContent() {
  // Try to find the main content area
  const mainSelectors = ['main', 'article', '[role="main"]', '#content', '.content', '#main-content', '.main-content'];
  let contentEl = null;

  for (const selector of mainSelectors) {
    contentEl = document.querySelector(selector);
    if (contentEl) break;
  }

  // Fallback: use entire body
  if (!contentEl) {
    contentEl = document.body;
  }

  // Clone to avoid modifying the live DOM
  const clone = contentEl.cloneNode(true);

  // Remove non-content elements
  const removeSelectors = [
    'script', 'style', 'noscript', 'iframe',
    'nav', 'footer', 'header',
    '[aria-hidden="true"]',
    '.cookie-banner', '.cookie-consent',
    '.advertisement', '.ad-container',
    '.sidebar', 'aside',
  ];

  removeSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Get clean text
  let text = clone.innerText || clone.textContent || '';

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  // Truncate if too long (100K chars max)
  const MAX_LENGTH = 100000;
  if (text.length > MAX_LENGTH) {
    text = text.substring(0, MAX_LENGTH) + '\n\n[Content truncated...]';
  }

  return {
    text: text,
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
  };
}
