/**
 * ConScan - Content Script
 * Executes in the context of the Confluence webpage.
 * Seamlessly leverages active browser session cookies for authenticated REST API calls.
 */

(() => {
  // Prevent duplicate injection
  if (window.__CONSCAN_INJECTED__) return;
  window.__CONSCAN_INJECTED__ = true;

  function detectConfluenceMeta() {
    let baseUrl = '';
    let contextPath = '';
    let currentUser = '';
    let currentFullName = '';

    // Check Confluence AJS meta tags
    const metaBase = document.querySelector('meta[name="ajs-confluence-base-url"]');
    const metaContext = document.querySelector('meta[name="ajs-context-path"]');
    const metaUser = document.querySelector('meta[name="ajs-remote-user"]');
    const metaName = document.querySelector('meta[name="ajs-current-user-fullname"]');

    if (metaBase) baseUrl = metaBase.getAttribute('content') || '';
    if (metaContext) contextPath = metaContext.getAttribute('content') || '';
    if (metaUser) currentUser = metaUser.getAttribute('content') || '';
    if (metaName) currentFullName = metaName.getAttribute('content') || '';

    // Check if on Atlassian Cloud or URL path contains /wiki
    const isAtlassianCloud = window.location.hostname.includes('atlassian.net');
    const pathHasWiki = window.location.pathname.startsWith('/wiki') || contextPath === '/wiki';

    // If not found in meta tags, infer from window.location
    if (!baseUrl) {
      const origin = window.location.origin;
      if (isAtlassianCloud || pathHasWiki) {
        baseUrl = origin + '/wiki';
      } else {
        baseUrl = origin + (contextPath || '');
      }
    } else {
      baseUrl = baseUrl.replace(/\/+$/, '');
      if ((isAtlassianCloud || pathHasWiki) && !baseUrl.endsWith('/wiki')) {
        baseUrl += '/wiki';
      }
    }

    // Determine REST base URL
    let restBase = '';
    if (baseUrl.endsWith('/wiki')) {
      restBase = baseUrl + '/rest/api';
    } else {
      restBase = baseUrl + '/rest/api';
    }

    const isConfluence = !!(
      metaBase ||
      metaContext ||
      document.querySelector('#main-header, #navigation, #com-atlassian-confluence') ||
      window.AJS ||
      window.location.hostname.includes('atlassian.net') ||
      window.location.pathname.includes('/wiki/') ||
      window.location.pathname.includes('/pages/')
    );

    return {
      isConfluence,
      baseUrl,
      restBase,
      contextPath,
      currentUser,
      currentFullName,
      pageTitle: document.title,
      currentUrl: window.location.href
    };
  }

  // Listen for messages from background script or dashboard tab
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'CONSCAN_PING') {
      const meta = detectConfluenceMeta();
      sendResponse({ success: true, meta });
      return true;
    }

    if (message.action === 'CONSCAN_FETCH') {
      const { url, options = {} } = message;

      const headers = {
        'Accept': 'application/json',
        'X-Atlassian-Token': 'no-check',
        ...(options.headers || {})
      };

      fetch(url, {
        method: options.method || 'GET',
        headers,
        credentials: 'include',
        body: options.body
      })
        .then(async (response) => {
          let data = null;
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await response.json().catch(() => null);
          } else {
            data = await response.text().catch(() => null);
          }

          sendResponse({
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            data
          });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            status: 0,
            statusText: 'Network Error',
            error: error.message || String(error)
          });
        });

      return true; // Keep message channel open for async response
    }

    if (message.action === 'CONSCAN_FETCH_BINARY') {
      const { url, options = {} } = message;

      fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        credentials: 'include'
      })
        .then(async (response) => {
          if (!response.ok) {
            sendResponse({
              success: false,
              status: response.status,
              statusText: response.statusText
            });
            return;
          }

          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            sendResponse({
              success: true,
              status: response.status,
              dataUrl: reader.result,
              size: blob.size,
              type: blob.type
            });
          };
          reader.onerror = () => {
            sendResponse({ success: false, error: 'Failed to read binary blob as data URL' });
          };
          reader.readAsDataURL(blob);
        })
        .catch((error) => {
          sendResponse({
            success: false,
            status: 0,
            error: error.message || String(error)
          });
        });

      return true;
    }
  });
})();
