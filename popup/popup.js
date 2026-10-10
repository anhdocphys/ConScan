/**
 * ConScan - Popup Controller
 */

let selectedTabId = null;
let selectedBaseUrl = '';

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusTitle = document.getElementById('statusTitle');
  const statusSub = document.getElementById('statusSub');
  const btnOpenDashboard = document.getElementById('btnOpenDashboard');
  const btnQuickScan = document.getElementById('btnQuickScan');
  const tabSelectGroup = document.getElementById('tabSelectGroup');
  const tabSelect = document.getElementById('tabSelect');

  // Find active tab first
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Query all Confluence tabs
  const response = await chrome.runtime.sendMessage({ action: 'GET_CONFLUENCE_TABS' });
  const confluenceTabs = response?.tabs || [];

  let matchedTab = null;

  // Check if active tab is a Confluence tab
  if (activeTab && activeTab.id) {
    const ensureResp = await chrome.runtime.sendMessage({
      action: 'ENSURE_CONTENT_SCRIPT',
      tabId: activeTab.id
    });

    if (ensureResp?.success && ensureResp.meta?.isConfluence) {
      matchedTab = {
        id: activeTab.id,
        title: activeTab.title,
        url: activeTab.url,
        meta: ensureResp.meta
      };
    }
  }

  // Fallback to any open Confluence tab if active tab isn't Confluence
  if (!matchedTab && confluenceTabs.length > 0) {
    matchedTab = confluenceTabs[0];
  }

  if (matchedTab) {
    selectedTabId = matchedTab.id;
    selectedBaseUrl = matchedTab.meta?.baseUrl || matchedTab.url;

    statusDot.className = 'status-indicator connected';
    try {
      const u = new URL(matchedTab.url);
      statusTitle.textContent = `Đã kết nối: ${u.hostname}`;
      statusSub.textContent = matchedTab.title || u.pathname;
    } catch {
      statusTitle.textContent = 'Đã nhận diện Confluence';
      statusSub.textContent = matchedTab.url;
    }

    btnQuickScan.disabled = false;
  } else {
    statusDot.className = 'status-indicator not-connected';
    statusTitle.textContent = 'Chưa phát hiện Confluence';
    statusSub.textContent = 'Hãy mở tab Confluence hoặc mở Dashboard';
    btnQuickScan.disabled = true;
  }

  // Populate multiple tabs dropdown if more than 1
  if (confluenceTabs.length > 1) {
    tabSelectGroup.classList.remove('hidden');
    tabSelect.innerHTML = '';
    confluenceTabs.forEach((tab) => {
      const opt = document.createElement('option');
      opt.value = tab.id;
      opt.textContent = tab.title || tab.url;
      if (tab.id === selectedTabId) opt.selected = true;
      tabSelect.appendChild(opt);
    });

    tabSelect.addEventListener('change', (e) => {
      selectedTabId = parseInt(e.target.value, 10);
      const chosen = confluenceTabs.find((t) => t.id === selectedTabId);
      if (chosen) {
        selectedBaseUrl = chosen.url;
        try {
          const u = new URL(chosen.url);
          statusTitle.textContent = `Đã chọn: ${u.hostname}`;
          statusSub.textContent = chosen.title || u.pathname;
        } catch {
          statusSub.textContent = chosen.url;
        }
      }
    });
  }

  // Open Dashboard Button
  btnOpenDashboard.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({
      action: 'OPEN_DASHBOARD',
      params: {
        tabId: selectedTabId,
        baseUrl: selectedBaseUrl
      }
    });
    window.close();
  });

  // Quick Scan Button
  btnQuickScan.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({
      action: 'OPEN_DASHBOARD',
      params: {
        tabId: selectedTabId,
        baseUrl: selectedBaseUrl,
        autoStart: '1'
      }
    });
    window.close();
  });

  // Quick Offline Space Export Button
  const btnQuickOffline = document.getElementById('btnQuickOffline');
  if (btnQuickOffline) {
    btnQuickOffline.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({
        action: 'OPEN_DASHBOARD',
        params: {
          tabId: selectedTabId,
          baseUrl: selectedBaseUrl,
          action: 'offline'
        }
      });
      window.close();
    });
  }
});
