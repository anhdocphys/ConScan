/**
 * ConScan - Background Service Worker (Manifest V3)
 * Handles tab management, content script injection, and routing.
 */

// Open or switch to Dashboard tab
async function openDashboardTab(params = {}) {
  const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find((t) => t.url && t.url.startsWith(dashboardUrl));

  if (existingTab && existingTab.id) {
    await chrome.tabs.update(existingTab.id, { active: true });
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return existingTab;
  }

  const queryParams = new URLSearchParams();
  if (params.tabId) queryParams.set('sourceTabId', params.tabId);
  if (params.baseUrl) queryParams.set('baseUrl', params.baseUrl);

  const finalUrl = queryParams.toString() ? `${dashboardUrl}?${queryParams.toString()}` : dashboardUrl;
  return await chrome.tabs.create({ url: finalUrl });
}

// Find open Confluence tabs
async function findConfluenceTabs() {
  const allTabs = await chrome.tabs.query({});
  const confluenceTabs = [];

  for (const tab of allTabs) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      continue;
    }

    const isMatch =
      tab.url.includes('.atlassian.net') ||
      tab.url.includes('/wiki') ||
      tab.url.includes('/confluence') ||
      (tab.title && (tab.title.includes('Confluence') || tab.title.includes('Atlassian')));

    if (isMatch) {
      confluenceTabs.push({
        id: tab.id,
        title: tab.title || tab.url,
        url: tab.url,
        favIconUrl: tab.favIconUrl || ''
      });
    }
  }

  return confluenceTabs;
}

// Inject content script into a tab if not already present
async function ensureContentScript(tabId) {
  try {
    const pingResponse = await chrome.tabs.sendMessage(tabId, { action: 'CONSCAN_PING' });
    if (pingResponse && pingResponse.success) {
      return pingResponse.meta;
    }
  } catch {
    // Content script not loaded yet, inject it
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content.js']
    });

    // Retry ping after injection
    const response = await chrome.tabs.sendMessage(tabId, { action: 'CONSCAN_PING' });
    return response?.meta || null;
  } catch (err) {
    console.error('Failed to inject content script:', err);
    return null;
  }
}

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'OPEN_DASHBOARD') {
        const tab = await openDashboardTab(message.params || {});
        sendResponse({ success: true, tabId: tab.id });
        return;
      }

      if (message.action === 'GET_CONFLUENCE_TABS') {
        const tabs = await findConfluenceTabs();
        sendResponse({ success: true, tabs });
        return;
      }

      if (message.action === 'ENSURE_CONTENT_SCRIPT') {
        const meta = await ensureContentScript(message.tabId);
        sendResponse({ success: !!meta, meta });
        return;
      }

      if (message.action === 'FETCH_CONFLUENCE_API') {
        const { tabId, url, options } = message;
        if (!tabId) {
          sendResponse({ success: false, error: 'No tabId specified' });
          return;
        }

        await ensureContentScript(tabId);
        const result = await chrome.tabs.sendMessage(tabId, {
          action: 'CONSCAN_FETCH',
          url,
          options
        });
        sendResponse(result);
        return;
      }

      sendResponse({ success: false, error: `Unknown action: ${message.action}` });
    } catch (err) {
      sendResponse({ success: false, error: err.message || String(err) });
    }
  })();

  return true; // Keep channel open for async response
});

// Extension icon click handler (if popup is not used or shortcut)
chrome.action.onClicked?.addListener(async (tab) => {
  await openDashboardTab({ tabId: tab.id });
});
