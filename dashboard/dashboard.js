/**
 * ConScan - Dashboard Application Controller
 */

import { ConfluenceApiClient } from '../shared/confluence-api.js';
import { OfflineSpaceExporter } from '../shared/offline-exporter.js';
import {
  formatBytes,
  formatDate,
  formatRelativeTime,
  getFileBadgeInfo,
  exportToCSV,
  exportToJSON
} from '../shared/utils.js';

// Application State
const state = {
  client: null,
  sourceTabId: null,
  baseUrl: '',
  allSpaces: [],
  selectedSpaceKeys: [],
  attachments: [],
  filteredAttachments: [],
  isScanning: false,
  isPaused: false,
  shouldStop: false,
  throttleMs: 100,

  // Table & View Filters
  searchQuery: '',
  filterCategory: 'all',
  filterSpaceKey: '',
  filterUploader: '',
  filterPageTitle: '',
  sortField: 'uploadDate',
  sortDirection: 'desc', // 'asc' or 'desc'
  currentPage: 1,
  pageSize: 50
};

// DOM Elements
let el = {};

document.addEventListener('DOMContentLoaded', async () => {
  initDOMElements();
  setupEventListeners();
  await loadSavedSettings();
  await initConfluenceConnection();
});

function initDOMElements() {
  el = {
    // Top Nav
    connectionPill: document.getElementById('connectionPill'),
    connectionDot: document.getElementById('connectionDot'),
    connectionText: document.getElementById('connectionText'),
    btnChangeTarget: document.getElementById('btnChangeTarget'),
    btnExportCSV: document.getElementById('btnExportCSV'),
    btnExportJSON: document.getElementById('btnExportJSON'),
    btnSettings: document.getElementById('btnSettings'),

    // Controls
    scopeAll: document.getElementById('scopeAll'),
    scopeSelected: document.getElementById('scopeSelected'),
    selectedSpacesBadge: document.getElementById('selectedSpacesBadge'),
    btnOpenSpaceModal: document.getElementById('btnOpenSpaceModal'),
    scanDateFrom: document.getElementById('scanDateFrom'),
    scanDateTo: document.getElementById('scanDateTo'),
    btnClearDates: document.getElementById('btnClearDates'),
    btnStartScan: document.getElementById('btnStartScan'),
    btnPauseScan: document.getElementById('btnPauseScan'),
    btnStopScan: document.getElementById('btnStopScan'),

    // Progress
    progressSection: document.getElementById('progressSection'),
    progressLabel: document.getElementById('progressLabel'),
    progressStats: document.getElementById('progressStats'),
    progressBarFill: document.getElementById('progressBarFill'),

    // Metrics
    metricTotalFiles: document.getElementById('metricTotalFiles'),
    metricTotalSize: document.getElementById('metricTotalSize'),
    metricTotalUsers: document.getElementById('metricTotalUsers'),
    metricTotalSpaces: document.getElementById('metricTotalSpaces'),

    // Category Counts
    catCountAll: document.getElementById('catCountAll'),
    catCountImage: document.getElementById('catCountImage'),
    catCountPdf: document.getElementById('catCountPdf'),
    catCountDoc: document.getElementById('catCountDoc'),
    catCountSheet: document.getElementById('catCountSheet'),
    catCountSlide: document.getElementById('catCountSlide'),
    catCountArchive: document.getElementById('catCountArchive'),
    catCountCode: document.getElementById('catCountCode'),
    catCountOther: document.getElementById('catCountOther'),
    categoryChips: document.getElementById('categoryChips'),

    // Filters
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    filterSpace: document.getElementById('filterSpace'),
    filterUploader: document.getElementById('filterUploader'),
    filterPage: document.getElementById('filterPage'),

    // Table
    table: document.getElementById('attachmentsTable'),
    tableBody: document.getElementById('tableBody'),
    emptyState: document.getElementById('emptyState'),
    noResultsState: document.getElementById('noResultsState'),
    btnResetFilters: document.getElementById('btnResetFilters'),

    // Pagination
    showingStart: document.getElementById('showingStart'),
    showingEnd: document.getElementById('showingEnd'),
    showingTotal: document.getElementById('showingTotal'),
    pageSizeSelect: document.getElementById('pageSizeSelect'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    pageCurrent: document.getElementById('pageCurrent'),

    // Modals
    spaceModal: document.getElementById('spaceModal'),
    btnCloseSpaceModal: document.getElementById('btnCloseSpaceModal'),
    spaceSearchInput: document.getElementById('spaceSearchInput'),
    btnSelectAllSpaces: document.getElementById('btnSelectAllSpaces'),
    btnDeselectAllSpaces: document.getElementById('btnDeselectAllSpaces'),
    modalSelectedCount: document.getElementById('modalSelectedCount'),
    spaceCheckboxList: document.getElementById('spaceCheckboxList'),
    btnApplySpaces: document.getElementById('btnApplySpaces'),

    settingsModal: document.getElementById('settingsModal'),
    btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
    cfgTabSelect: document.getElementById('cfgTabSelect'),
    cfgBaseUrl: document.getElementById('cfgBaseUrl'),
    cfgApiToken: document.getElementById('cfgApiToken'),
    cfgThrottle: document.getElementById('cfgThrottle'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),

    // Offline Space Exporter Modal
    btnOpenOfflineModal: document.getElementById('btnOpenOfflineModal'),
    offlineModal: document.getElementById('offlineModal'),
    btnCloseOfflineModal: document.getElementById('btnCloseOfflineModal'),
    offlineSpaceSelect: document.getElementById('offlineSpaceSelect'),
    offlineSpaceHint: document.getElementById('offlineSpaceHint'),
    chkIncludeAttachments: document.getElementById('chkIncludeAttachments'),
    chkInteractiveViewer: document.getElementById('chkInteractiveViewer'),
    offlineFormView: document.getElementById('offlineFormView'),
    offlineProgressView: document.getElementById('offlineProgressView'),
    offlineSuccessView: document.getElementById('offlineSuccessView'),
    offlineStep1: document.getElementById('offlineStep1'),
    offlineStep2: document.getElementById('offlineStep2'),
    offlineStep3: document.getElementById('offlineStep3'),
    offlineStep4: document.getElementById('offlineStep4'),
    offlineLine1: document.getElementById('offlineLine1'),
    offlineLine2: document.getElementById('offlineLine2'),
    offlineLine3: document.getElementById('offlineLine3'),
    offlineProgressLabel: document.getElementById('offlineProgressLabel'),
    offlineProgressBarFill: document.getElementById('offlineProgressBarFill'),
    offlineProgressSub: document.getElementById('offlineProgressSub'),
    offlineSuccessDesc: document.getElementById('offlineSuccessDesc'),
    btnStartOfflineExport: document.getElementById('btnStartOfflineExport'),
    btnCancelOfflineExport: document.getElementById('btnCancelOfflineExport'),
    btnCloseOfflineExportDone: document.getElementById('btnCloseOfflineExportDone')
  };
}

function setupEventListeners() {
  // Start / Pause / Stop Scan
  el.btnStartScan.addEventListener('click', () => startScanning());
  el.btnPauseScan.addEventListener('click', () => togglePause());
  el.btnStopScan.addEventListener('click', () => stopScanning());

  // Scope toggle
  el.scopeAll.addEventListener('change', () => {
    el.btnOpenSpaceModal.classList.add('hidden');
  });
  el.scopeSelected.addEventListener('change', () => {
    el.btnOpenSpaceModal.classList.remove('hidden');
    openSpaceModal();
  });
  el.btnOpenSpaceModal.addEventListener('click', () => openSpaceModal());

  // Date filters
  el.btnClearDates.addEventListener('click', () => {
    el.scanDateFrom.value = '';
    el.scanDateTo.value = '';
    applyFilters();
  });
  el.scanDateFrom.addEventListener('change', () => applyFilters());
  el.scanDateTo.addEventListener('change', () => applyFilters());

  // Export
  el.btnExportCSV.addEventListener('click', () => exportData('csv'));
  el.btnExportJSON.addEventListener('click', () => exportData('json'));

  // Search & Filters
  el.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    el.btnClearSearch.classList.toggle('hidden', !state.searchQuery);
    state.currentPage = 1;
    applyFilters();
  });

  el.btnClearSearch.addEventListener('click', () => {
    el.searchInput.value = '';
    state.searchQuery = '';
    el.btnClearSearch.classList.add('hidden');
    state.currentPage = 1;
    applyFilters();
  });

  el.filterSpace.addEventListener('change', (e) => {
    state.filterSpaceKey = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  el.filterUploader.addEventListener('change', (e) => {
    state.filterUploader = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  el.filterPage.addEventListener('change', (e) => {
    state.filterPageTitle = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  el.btnResetFilters.addEventListener('click', () => resetFilters());

  // Category Chips
  el.categoryChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    el.categoryChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    state.filterCategory = chip.dataset.category || 'all';
    state.currentPage = 1;
    applyFilters();
  });

  // Sorting
  el.table.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (state.sortField === field) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = field;
        state.sortDirection = 'desc';
      }
      updateSortIndicators();
      applyFilters();
    });
  });

  // Pagination
  el.pageSizeSelect.addEventListener('change', (e) => {
    state.pageSize = e.target.value === 'all' ? 999999 : parseInt(e.target.value, 10);
    state.currentPage = 1;
    renderTable();
  });

  el.btnPrevPage.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderTable();
    }
  });

  el.btnNextPage.addEventListener('click', () => {
    const maxPage = Math.ceil(state.filteredAttachments.length / state.pageSize) || 1;
    if (state.currentPage < maxPage) {
      state.currentPage++;
      renderTable();
    }
  });

  // Modals
  el.btnChangeTarget.addEventListener('click', () => openSettingsModal());
  el.btnSettings.addEventListener('click', () => openSettingsModal());
  el.btnCloseSettingsModal.addEventListener('click', () => closeSettingsModal());
  el.btnSaveSettings.addEventListener('click', () => saveSettings());

  el.btnCloseSpaceModal.addEventListener('click', () => closeSpaceModal());
  el.btnApplySpaces.addEventListener('click', () => applySpaceModalSelection());
  el.btnSelectAllSpaces.addEventListener('click', () => selectAllSpaces(true));
  el.btnDeselectAllSpaces.addEventListener('click', () => selectAllSpaces(false));
  el.spaceSearchInput.addEventListener('input', (e) => filterSpacesInModal(e.target.value));

  // Offline Exporter Listeners
  el.btnOpenOfflineModal.addEventListener('click', () => openOfflineModal());
  el.btnCloseOfflineModal.addEventListener('click', () => closeOfflineModal());
  el.btnStartOfflineExport.addEventListener('click', () => startOfflineExport());
  el.btnCancelOfflineExport.addEventListener('click', () => cancelOfflineExport());
  el.btnCloseOfflineExportDone.addEventListener('click', () => closeOfflineModal());
}

// ---------------- Confluence Connection ---------------- //

async function loadSavedSettings() {
  const data = await chrome.storage.local.get(['confluenceBaseUrl', 'apiToken', 'throttleMs']);
  if (data.confluenceBaseUrl) state.baseUrl = data.confluenceBaseUrl;
  if (data.throttleMs) state.throttleMs = parseInt(data.throttleMs, 10);
}

async function initConfluenceConnection() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramTabId = urlParams.get('sourceTabId');
  const paramBaseUrl = urlParams.get('baseUrl');
  const autoStart = urlParams.get('autoStart');

  if (paramTabId) {
    state.sourceTabId = parseInt(paramTabId, 10);
  }
  if (paramBaseUrl) {
    state.baseUrl = paramBaseUrl;
  }

  // If no tabId yet, discover open Confluence tabs
  if (!state.sourceTabId) {
    const resp = await chrome.runtime.sendMessage({ action: 'GET_CONFLUENCE_TABS' });
    const tabs = resp?.tabs || [];
    if (tabs.length > 0) {
      state.sourceTabId = tabs[0].id;
      if (!state.baseUrl) state.baseUrl = tabs[0].url;
    }
  }

  // Create API client
  state.client = new ConfluenceApiClient({
    baseUrl: state.baseUrl,
    tabId: state.sourceTabId
  });

  // Test and display connection
  await updateConnectionStatus();

  // If autoStart passed, immediately trigger scan
  if (autoStart === '1') {
    startScanning();
  } else if (urlParams.get('action') === 'offline') {
    openOfflineModal();
  }
}

async function updateConnectionStatus() {
  if (state.sourceTabId) {
    const ensureResp = await chrome.runtime.sendMessage({
      action: 'ENSURE_CONTENT_SCRIPT',
      tabId: state.sourceTabId
    });

    if (ensureResp?.success && ensureResp.meta) {
      const meta = ensureResp.meta;
      state.baseUrl = meta.baseUrl || state.baseUrl;
      state.client.setBaseUrl(state.baseUrl);
      state.baseUrl = state.client.baseUrl;

      el.connectionDot.className = 'pulse-dot connected';
      try {
        const u = new URL(state.baseUrl);
        const userText = meta.currentUser ? ` (${meta.currentUser})` : '';
        el.connectionText.textContent = `Đã kết nối: ${u.hostname}${userText}`;
      } catch {
        el.connectionText.textContent = `Đã kết nối: ${state.baseUrl}`;
      }
      return;
    }
  }

  if (state.baseUrl) {
    el.connectionDot.className = 'pulse-dot connected';
    el.connectionText.textContent = `Địa chỉ: ${state.baseUrl}`;
    return;
  }

  el.connectionDot.className = 'pulse-dot';
  el.connectionText.textContent = 'Chưa kết nối Confluence (Bấm để cài đặt)';
}

// ---------------- Space Loading & Selection ---------------- //

async function loadSpaces() {
  if (state.allSpaces.length > 0) return state.allSpaces;

  try {
    el.spaceCheckboxList.innerHTML = '<div class="loading-spinner-box">Đang quét danh sách Spaces bạn có quyền...</div>';
    const spaces = await state.client.getSpaces((progress) => {
      el.spaceCheckboxList.innerHTML = `<div class="loading-spinner-box">Đã tải ${progress.loaded} Spaces...</div>`;
    });
    state.allSpaces = spaces;
    populateSpaceModalList();
    populateSpaceDropdown();
    return spaces;
  } catch (err) {
    el.spaceCheckboxList.innerHTML = `<div class="loading-spinner-box text-danger">Lỗi tải Spaces: ${err.message}</div>`;
    return [];
  }
}

function populateSpaceDropdown() {
  el.filterSpace.innerHTML = '<option value="">Tất cả Spaces</option>';
  state.allSpaces.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.key;
    opt.textContent = `${s.name} (${s.key})`;
    el.filterSpace.appendChild(opt);
  });
}

function openSpaceModal() {
  el.spaceModal.classList.remove('hidden');
  loadSpaces();
}

function closeSpaceModal() {
  el.spaceModal.classList.add('hidden');
}

function populateSpaceModalList() {
  el.spaceCheckboxList.innerHTML = '';
  if (state.allSpaces.length === 0) {
    el.spaceCheckboxList.innerHTML = '<div class="loading-spinner-box">Không tìm thấy space nào.</div>';
    return;
  }

  state.allSpaces.forEach((space) => {
    const isChecked = state.selectedSpaceKeys.includes(space.key);
    const label = document.createElement('label');
    label.className = 'space-check-item';
    label.dataset.spaceName = (space.name + ' ' + space.key).toLowerCase();

    label.innerHTML = `
      <input type="checkbox" value="${space.key}" ${isChecked ? 'checked' : ''}>
      <span>${escapeHtml(space.name)}</span>
      <span class="space-key-pill">${escapeHtml(space.key)}</span>
    `;

    label.querySelector('input').addEventListener('change', updateModalSelectedCount);
    el.spaceCheckboxList.appendChild(label);
  });

  updateModalSelectedCount();
}

function updateModalSelectedCount() {
  const checked = el.spaceCheckboxList.querySelectorAll('input:checked').length;
  el.modalSelectedCount.textContent = `Đã chọn ${checked} / ${state.allSpaces.length} spaces`;
}

function selectAllSpaces(select) {
  el.spaceCheckboxList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    const item = cb.closest('.space-check-item');
    if (item.style.display !== 'none') {
      cb.checked = select;
    }
  });
  updateModalSelectedCount();
}

function filterSpacesInModal(keyword) {
  const kw = keyword.toLowerCase().trim();
  el.spaceCheckboxList.querySelectorAll('.space-check-item').forEach((item) => {
    const match = !kw || item.dataset.spaceName.includes(kw);
    item.style.display = match ? 'flex' : 'none';
  });
}

function applySpaceModalSelection() {
  const checked = Array.from(el.spaceCheckboxList.querySelectorAll('input:checked')).map((cb) => cb.value);
  state.selectedSpaceKeys = checked;
  el.selectedSpacesBadge.textContent = `Chọn Spaces (${checked.length})`;
  if (checked.length > 0) {
    el.scopeSelected.checked = true;
    el.btnOpenSpaceModal.classList.remove('hidden');
  } else {
    el.scopeAll.checked = true;
    el.btnOpenSpaceModal.classList.add('hidden');
  }
  closeSpaceModal();
}

// ---------------- Scanning Engine ---------------- //

async function startScanning() {
  if (state.isScanning) return;

  state.isScanning = true;
  state.isPaused = false;
  state.shouldStop = false;
  state.attachments = [];
  state.filteredAttachments = [];

  // Update UI for scanning state
  el.btnStartScan.classList.add('hidden');
  el.btnPauseScan.classList.remove('hidden');
  el.btnStopScan.classList.remove('hidden');
  el.progressSection.classList.remove('hidden');
  el.progressBarFill.style.width = '5%';
  el.btnExportCSV.disabled = true;
  el.btnExportJSON.disabled = true;

  updateMetrics();
  renderTable();

  try {
    // 1. Ensure target connection
    if (!state.client) {
      state.client = new ConfluenceApiClient({ baseUrl: state.baseUrl, tabId: state.sourceTabId });
    }
    await state.client.detectApiBase();

    // 2. Determine spaces
    let targetSpaces = [];
    if (el.scopeSelected.checked && state.selectedSpaceKeys.length > 0) {
      targetSpaces = state.selectedSpaceKeys;
    } else {
      // Scan all spaces accessible
      el.progressLabel.textContent = 'Đang tải danh sách các Space có quyền...';
      const spaces = await loadSpaces();
      targetSpaces = spaces.map((s) => s.key);
    }

    if (targetSpaces.length === 0) {
      el.progressLabel.textContent = 'Quét tất cả không gian qua CQL search...';
    } else {
      el.progressLabel.textContent = `Chuẩn bị quét ${targetSpaces.length} spaces...`;
    }

    // 3. Perform scan using CQL
    await runCQLScan(targetSpaces);
  } catch (err) {
    console.error('Scan error:', err);
    el.progressLabel.textContent = `Lỗi trong quá trình quét: ${err.message}`;
    el.progressBarFill.style.background = '#FF5630';
  } finally {
    state.isScanning = false;
    state.isPaused = false;
    el.btnStartScan.classList.remove('hidden');
    el.btnPauseScan.classList.add('hidden');
    el.btnStopScan.classList.add('hidden');

    if (!state.shouldStop) {
      el.progressBarFill.style.width = '100%';
      el.progressLabel.textContent = `✅ Quét hoàn tất! Đã tìm thấy tổng cộng ${state.attachments.length} tệp đính kèm.`;
    } else {
      el.progressLabel.textContent = `⏹ Đã dừng quét. Hiển thị ${state.attachments.length} tệp đã thu thập được.`;
    }

    el.btnExportCSV.disabled = state.attachments.length === 0;
    el.btnExportJSON.disabled = state.attachments.length === 0;
  }
}

async function runCQLScan(spaceKeys) {
  const dateFrom = el.scanDateFrom.value;
  const dateTo = el.scanDateTo.value;
  const limit = 50;
  let start = 0;
  let hasMore = true;
  let totalFound = 0;

  // If there are many spaces and CQL is too long, we batch in chunks of 20 spaces
  const spaceBatches = [];
  if (spaceKeys && spaceKeys.length > 0) {
    const CHUNK_SIZE = 20;
    for (let i = 0; i < spaceKeys.length; i += CHUNK_SIZE) {
      spaceBatches.push(spaceKeys.slice(i, i + CHUNK_SIZE));
    }
  } else {
    spaceBatches.push([]); // All spaces
  }

  for (let batchIdx = 0; batchIdx < spaceBatches.length; batchIdx++) {
    if (state.shouldStop) break;

    const currentSpaceBatch = spaceBatches[batchIdx];
    start = 0;
    hasMore = true;

    while (hasMore) {
      if (state.shouldStop) break;

      // Handle Pause
      while (state.isPaused && !state.shouldStop) {
        await new Promise((r) => setTimeout(r, 200));
      }

      const batchLabel =
        currentSpaceBatch.length > 0
          ? `(Nhóm space ${batchIdx + 1}/${spaceBatches.length}: ${currentSpaceBatch.slice(0, 3).join(', ')}...)`
          : '(Tất cả spaces)';

      el.progressLabel.textContent = `Đang quét attachments ${batchLabel}... Đã duyệt ${start} bản ghi`;

      let response;
      try {
        response = await state.client.searchAttachmentsCQL({
          spaceKeys: currentSpaceBatch,
          dateFrom,
          dateTo,
          start,
          limit
        });
      } catch (cqlErr) {
        console.warn('CQL failed, falling back to space-by-space crawl:', cqlErr);
        // Fallback to space crawl if CQL not supported
        if (currentSpaceBatch.length > 0) {
          await runSpaceBySpaceFallback(currentSpaceBatch);
        }
        return;
      }

      const results = response.results || [];
      if (results.length > 0) {
        // Append unique attachments
        results.forEach((att) => {
          if (!state.attachments.some((a) => a.id === att.id)) {
            state.attachments.push(att);
            totalFound++;
          }
        });

        updateMetrics();
        applyFilters();
      }

      el.progressStats.textContent = `${totalFound} tệp tìm thấy`;

      // Estimate progress
      if (response.totalSize && response.totalSize > 0) {
        const pct = Math.min(95, Math.round(((start + results.length) / response.totalSize) * 100));
        el.progressBarFill.style.width = `${pct}%`;
      } else {
        const pct = Math.min(90, Math.round(((batchIdx + 1) / spaceBatches.length) * 100));
        el.progressBarFill.style.width = `${pct}%`;
      }

      if (!response.hasMore || results.length < limit) {
        hasMore = false;
      } else {
        start += limit;
      }

      // Respect throttle
      if (state.throttleMs > 0) {
        await new Promise((r) => setTimeout(r, state.throttleMs));
      }
    }
  }
}

// Fallback: If CQL fails, iterate each space and page
async function runSpaceBySpaceFallback(spaces) {
  el.progressLabel.textContent = 'Chuyển sang chế độ duyệt từng trang (Deep Crawl)...';
  let totalFound = 0;

  for (let i = 0; i < spaces.length; i++) {
    if (state.shouldStop) break;
    const spaceKey = spaces[i];
    el.progressLabel.textContent = `Đang quét pages trong space [${spaceKey}] (${i + 1}/${spaces.length})...`;

    try {
      const pageData = await state.client.getSpacePages(spaceKey, 0, 100);
      const pages = pageData.pages || [];

      for (const page of pages) {
        if (state.shouldStop) break;
        while (state.isPaused && !state.shouldStop) {
          await new Promise((r) => setTimeout(r, 200));
        }

        try {
          const attResp = await state.client.getPageAttachments(page.id, 0, 50);
          const atts = attResp.attachments || [];
          atts.forEach((a) => {
            if (!state.attachments.some((item) => item.id === a.id)) {
              state.attachments.push(a);
              totalFound++;
            }
          });

          if (atts.length > 0) {
            updateMetrics();
            applyFilters();
            el.progressStats.textContent = `${totalFound} tệp tìm thấy`;
          }
        } catch {
          // Page attachment error ignored
        }

        if (state.throttleMs > 0) {
          await new Promise((r) => setTimeout(r, state.throttleMs));
        }
      }
    } catch {
      // Space error ignored
    }

    el.progressBarFill.style.width = `${Math.round(((i + 1) / spaces.length) * 100)}%`;
  }
}

function togglePause() {
  state.isPaused = !state.isPaused;
  if (state.isPaused) {
    el.btnPauseScan.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      Tiếp tục
    `;
    el.progressLabel.textContent = '⏸ Quá trình quét đang tạm dừng...';
  } else {
    el.btnPauseScan.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
      Tạm dừng
    `;
  }
}

function stopScanning() {
  state.shouldStop = true;
  state.isPaused = false;
  el.progressLabel.textContent = 'Đang dừng quét...';
}

// ---------------- Metrics & Category Counts ---------------- //

function updateMetrics() {
  const totalFiles = state.attachments.length;
  let totalBytes = 0;
  const uniqueUsers = new Set();
  const uniqueSpaces = new Set();

  const catCounts = {
    all: totalFiles,
    image: 0,
    pdf: 0,
    document: 0,
    spreadsheet: 0,
    presentation: 0,
    archive: 0,
    code: 0,
    other: 0
  };

  state.attachments.forEach((a) => {
    totalBytes += a.fileSize || 0;
    if (a.uploadedBy) uniqueUsers.add(a.uploadedBy);
    if (a.spaceKey) uniqueSpaces.add(a.spaceKey);
    if (catCounts[a.category] !== undefined) {
      catCounts[a.category]++;
    } else {
      catCounts.other++;
    }
  });

  el.metricTotalFiles.textContent = totalFiles.toLocaleString('vi-VN');
  el.metricTotalSize.textContent = formatBytes(totalBytes);
  el.metricTotalUsers.textContent = uniqueUsers.size.toLocaleString('vi-VN');
  el.metricTotalSpaces.textContent = uniqueSpaces.size.toLocaleString('vi-VN');

  el.catCountAll.textContent = catCounts.all;
  el.catCountImage.textContent = catCounts.image;
  el.catCountPdf.textContent = catCounts.pdf;
  el.catCountDoc.textContent = catCounts.document;
  el.catCountSheet.textContent = catCounts.spreadsheet;
  el.catCountSlide.textContent = catCounts.presentation;
  el.catCountArchive.textContent = catCounts.archive;
  el.catCountCode.textContent = catCounts.code;
  el.catCountOther.textContent = catCounts.other;

  updateFilterOptions();
}

function updateFilterOptions() {
  // Update uploader dropdown
  const currentUploader = el.filterUploader.value;
  const users = [...new Set(state.attachments.map((a) => a.uploadedBy).filter(Boolean))].sort();

  el.filterUploader.innerHTML = '<option value="">Tất cả Người upload</option>';
  users.forEach((u) => {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    if (u === currentUploader) opt.selected = true;
    el.filterUploader.appendChild(opt);
  });

  // Update page dropdown
  const currentPageVal = el.filterPage.value;
  const pages = [...new Set(state.attachments.map((a) => a.pageTitle).filter(Boolean))].sort();

  el.filterPage.innerHTML = '<option value="">Tất cả Pages</option>';
  pages.slice(0, 200).forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    if (p === currentPageVal) opt.selected = true;
    el.filterPage.appendChild(opt);
  });
}

// ---------------- Filtering, Sorting & Rendering ---------------- //

function applyFilters() {
  let list = [...state.attachments];

  // Category filter
  if (state.filterCategory !== 'all') {
    list = list.filter((a) => a.category === state.filterCategory);
  }

  // Space filter
  if (state.filterSpaceKey) {
    list = list.filter((a) => a.spaceKey === state.filterSpaceKey);
  }

  // Uploader filter
  if (state.filterUploader) {
    list = list.filter((a) => a.uploadedBy === state.filterUploader);
  }

  // Page filter
  if (state.filterPageTitle) {
    list = list.filter((a) => a.pageTitle === state.filterPageTitle);
  }

  // Date Range filter
  const from = el.scanDateFrom.value;
  const to = el.scanDateTo.value;
  if (from) {
    const fromTime = new Date(from).getTime();
    list = list.filter((a) => a.uploadDate && new Date(a.uploadDate).getTime() >= fromTime);
  }
  if (to) {
    const toTime = new Date(to + 'T23:59:59').getTime();
    list = list.filter((a) => a.uploadDate && new Date(a.uploadDate).getTime() <= toTime);
  }

  // Text Search
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter((a) => {
      return (
        a.filename.toLowerCase().includes(q) ||
        a.pageTitle.toLowerCase().includes(q) ||
        a.uploadedBy.toLowerCase().includes(q) ||
        a.spaceName.toLowerCase().includes(q) ||
        a.spaceKey.toLowerCase().includes(q)
      );
    });
  }

  // Sorting
  list.sort((a, b) => {
    let valA = a[state.sortField] ?? '';
    let valB = b[state.sortField] ?? '';

    if (state.sortField === 'uploadDate') {
      valA = new Date(valA).getTime() || 0;
      valB = new Date(valB).getTime() || 0;
    } else if (state.sortField === 'fileSize') {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  state.filteredAttachments = list;
  renderTable();
}

function resetFilters() {
  el.searchInput.value = '';
  state.searchQuery = '';
  el.btnClearSearch.classList.add('hidden');
  el.filterSpace.value = '';
  state.filterSpaceKey = '';
  el.filterUploader.value = '';
  state.filterUploader = '';
  el.filterPage.value = '';
  state.filterPageTitle = '';
  el.scanDateFrom.value = '';
  el.scanDateTo.value = '';

  el.categoryChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  el.categoryChips.querySelector('[data-category="all"]').classList.add('active');
  state.filterCategory = 'all';

  state.currentPage = 1;
  applyFilters();
}

function updateSortIndicators() {
  el.table.querySelectorAll('th.sortable').forEach((th) => {
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.sort === state.sortField) {
      icon.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
      th.style.color = 'var(--primary)';
    } else {
      icon.textContent = '⇅';
      th.style.color = '';
    }
  });
}

function renderTable() {
  const total = state.filteredAttachments.length;
  el.showingTotal.textContent = total.toLocaleString('vi-VN');

  // Handle empty states
  if (state.attachments.length === 0) {
    el.emptyState.classList.remove('hidden');
    el.noResultsState.classList.add('hidden');
    el.tableBody.innerHTML = '';
    el.showingStart.textContent = '0';
    el.showingEnd.textContent = '0';
    el.btnPrevPage.disabled = true;
    el.btnNextPage.disabled = true;
    el.pageCurrent.textContent = 'Trang 1 / 1';
    return;
  }

  if (total === 0) {
    el.emptyState.classList.add('hidden');
    el.noResultsState.classList.remove('hidden');
    el.tableBody.innerHTML = '';
    el.showingStart.textContent = '0';
    el.showingEnd.textContent = '0';
    el.btnPrevPage.disabled = true;
    el.btnNextPage.disabled = true;
    el.pageCurrent.textContent = 'Trang 1 / 1';
    return;
  }

  el.emptyState.classList.add('hidden');
  el.noResultsState.classList.add('hidden');

  // Pagination slice
  const maxPage = Math.ceil(total / state.pageSize) || 1;
  if (state.currentPage > maxPage) state.currentPage = maxPage;

  const startIdx = (state.currentPage - 1) * state.pageSize;
  const endIdx = Math.min(startIdx + state.pageSize, total);
  const pageItems = state.filteredAttachments.slice(startIdx, endIdx);

  el.showingStart.textContent = (startIdx + 1).toLocaleString('vi-VN');
  el.showingEnd.textContent = endIdx.toLocaleString('vi-VN');
  el.pageCurrent.textContent = `Trang ${state.currentPage} / ${maxPage}`;
  el.btnPrevPage.disabled = state.currentPage <= 1;
  el.btnNextPage.disabled = state.currentPage >= maxPage;

  // Render rows
  const fragment = document.createDocumentFragment();
  pageItems.forEach((att) => {
    const tr = document.createElement('tr');
    const badgeInfo = getFileBadgeInfo(att.category, att.extension);
    const initials = getInitials(att.uploadedBy);

    tr.innerHTML = `
      <td class="col-file">
        <div class="file-cell">
          <span class="file-badge" style="background:${badgeInfo.bg}; color:${badgeInfo.text};">
            ${escapeHtml(badgeInfo.label)}
          </span>
          <div class="file-name-box">
            <a href="${escapeHtml(att.downloadUrl || att.viewUrl)}" target="_blank" class="file-title-link" title="${escapeHtml(att.filename)}">
              ${escapeHtml(att.filename)}
            </a>
            <span class="file-meta-sub">v${att.version} ${att.comment ? '• ' + escapeHtml(att.comment) : ''}</span>
          </div>
        </div>
      </td>
      <td class="col-space">
        <span class="space-badge" title="${escapeHtml(att.spaceName)} (${escapeHtml(att.spaceKey)})">
          🏷️ ${escapeHtml(att.spaceName)}
        </span>
      </td>
      <td class="col-page">
        ${
          att.pageUrl
            ? `<a href="${escapeHtml(att.pageUrl)}" target="_blank" class="page-link" title="${escapeHtml(att.pageTitle)}">📄 ${escapeHtml(att.pageTitle)}</a>`
            : `<span class="page-link" title="${escapeHtml(att.pageTitle)}">📄 ${escapeHtml(att.pageTitle)}</span>`
        }
      </td>
      <td class="col-author">
        <div class="uploader-cell">
          <div class="avatar-circle" style="background:${getAvatarColor(att.uploadedBy)}">
            ${escapeHtml(initials)}
          </div>
          <div class="uploader-info">
            <span class="uploader-name" title="${escapeHtml(att.uploadedBy)}">${escapeHtml(att.uploadedBy)}</span>
            ${att.uploadedByUsername ? `<span class="uploader-sub">@${escapeHtml(att.uploadedByUsername)}</span>` : ''}
          </div>
        </div>
      </td>
      <td class="col-date">
        <div class="date-cell">
          <span class="date-main">${escapeHtml(att.formattedDate)}</span>
          <span class="date-rel">${escapeHtml(att.relativeTime)}</span>
        </div>
      </td>
      <td class="col-size">
        <span class="size-cell">${escapeHtml(att.formattedSize)}</span>
      </td>
      <td class="col-actions">
        <div class="actions-cell">
          ${
            att.downloadUrl
              ? `<a href="${escapeHtml(att.downloadUrl)}" target="_blank" download="${escapeHtml(att.filename)}" class="btn btn-outline btn-sm" title="Tải xuống tệp">
                  ⬇️ Tải
                </a>`
              : ''
          }
          ${
            att.pageUrl
              ? `<a href="${escapeHtml(att.pageUrl)}" target="_blank" class="btn btn-ghost btn-sm" title="Mở trang Confluence">
                  🔗 Trang
                </a>`
              : ''
          }
          <button class="btn-icon btn-copy-link" data-url="${escapeHtml(att.downloadUrl || att.pageUrl)}" title="Sao chép liên kết">
            📋
          </button>
        </div>
      </td>
    `;

    fragment.appendChild(tr);
  });

  el.tableBody.innerHTML = '';
  el.tableBody.appendChild(fragment);

  // Bind copy link buttons
  el.tableBody.querySelectorAll('.btn-copy-link').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const url = btn.dataset.url;
      if (url) {
        await navigator.clipboard.writeText(url);
        const originalText = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 1200);
      }
    });
  });
}

// ---------------- Export Data ---------------- //

function exportData(type) {
  const data = state.filteredAttachments.length > 0 ? state.filteredAttachments : state.attachments;
  if (data.length === 0) return;

  const timestamp = new Date().toISOString().slice(0, 10);
  if (type === 'csv') {
    exportToCSV(data, `confluence-attachments-${timestamp}.csv`);
  } else if (type === 'json') {
    exportToJSON(data, `confluence-attachments-${timestamp}.json`);
  }
}

// ---------------- Settings Modal ---------------- //

async function openSettingsModal() {
  el.settingsModal.classList.remove('hidden');

  // Load Confluence tabs
  const resp = await chrome.runtime.sendMessage({ action: 'GET_CONFLUENCE_TABS' });
  const tabs = resp?.tabs || [];

  el.cfgTabSelect.innerHTML = '<option value="">-- Không chọn tab (Nhập URL thủ công) --</option>';
  tabs.forEach((tab) => {
    const opt = document.createElement('option');
    opt.value = tab.id;
    opt.dataset.url = tab.url;
    opt.textContent = `${tab.title || tab.url} (ID: ${tab.id})`;
    if (tab.id === state.sourceTabId) opt.selected = true;
    el.cfgTabSelect.appendChild(opt);
  });

  el.cfgBaseUrl.value = state.baseUrl || '';
  el.cfgThrottle.value = state.throttleMs || 100;
}

function closeSettingsModal() {
  el.settingsModal.classList.add('hidden');
}

async function saveSettings() {
  const selectedTab = el.cfgTabSelect.options[el.cfgTabSelect.selectedIndex];
  if (selectedTab && selectedTab.value) {
    state.sourceTabId = parseInt(selectedTab.value, 10);
    state.baseUrl = selectedTab.dataset.url || state.baseUrl;
  } else {
    state.sourceTabId = null;
    state.baseUrl = el.cfgBaseUrl.value.trim();
  }

  const apiToken = el.cfgApiToken.value.trim();
  const throttleMs = parseInt(el.cfgThrottle.value, 10) || 100;
  state.throttleMs = throttleMs;

  await chrome.storage.local.set({
    confluenceBaseUrl: state.baseUrl,
    apiToken,
    throttleMs
  });

  state.client = new ConfluenceApiClient({
    baseUrl: state.baseUrl,
    tabId: state.sourceTabId,
    apiToken
  });

  await updateConnectionStatus();
  closeSettingsModal();
}

// ---------------- Helpers ---------------- //

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(name = '') {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name = '') {
  const colors = ['#0052CC', '#00875A', '#FFAB00', '#6554C0', '#36B37E', '#FF5630', '#00B8D9', '#403294'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ---------------- Offline Space Exporter ---------------- //

let offlineExporterCancel = false;

async function openOfflineModal() {
  el.offlineModal.classList.remove('hidden');
  el.offlineFormView.classList.remove('hidden');
  el.offlineProgressView.classList.add('hidden');
  el.offlineSuccessView.classList.add('hidden');
  el.btnStartOfflineExport.classList.remove('hidden');
  el.btnCancelOfflineExport.classList.add('hidden');
  el.btnCloseOfflineExportDone.classList.add('hidden');

  await populateOfflineSpaceSelect();
}

function closeOfflineModal() {
  if (offlineExporterCancel === false && !el.offlineProgressView.classList.contains('hidden')) {
    if (!confirm('Quá trình tải đang diễn ra. Bạn có chắc muốn dừng và đóng lại?')) {
      return;
    }
    offlineExporterCancel = true;
  }
  el.offlineModal.classList.add('hidden');
}

async function populateOfflineSpaceSelect() {
  el.offlineSpaceSelect.innerHTML = '<option value="">-- Đang tải danh sách Spaces... --</option>';
  const spaces = await loadSpaces();
  el.offlineSpaceSelect.innerHTML = '<option value="">-- Chọn một Space cần tải --</option>';

  if (spaces.length === 0) {
    el.offlineSpaceSelect.innerHTML = '<option value="">Không tìm thấy Space nào</option>';
    return;
  }

  spaces.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.key;
    opt.textContent = `${s.name} (${s.key})`;
    opt.dataset.spaceName = s.name;
    el.offlineSpaceSelect.appendChild(opt);
  });
}

function setOfflineStep(step) {
  const steps = [el.offlineStep1, el.offlineStep2, el.offlineStep3, el.offlineStep4];
  const lines = [el.offlineLine1, el.offlineLine2, el.offlineLine3];

  steps.forEach((s, idx) => {
    if (idx + 1 < step) {
      s.className = 'step-item done';
    } else if (idx + 1 === step) {
      s.className = 'step-item active';
    } else {
      s.className = 'step-item';
    }
  });

  lines.forEach((l, idx) => {
    if (idx + 1 < step) {
      l.className = 'step-line done';
    } else {
      l.className = 'step-line';
    }
  });
}

async function startOfflineExport() {
  const spaceKey = el.offlineSpaceSelect.value;
  if (!spaceKey) {
    alert('Vui lòng chọn một Space cần tải xuống.');
    return;
  }

  const selectedOpt = el.offlineSpaceSelect.options[el.offlineSpaceSelect.selectedIndex];
  const spaceName = selectedOpt.dataset.spaceName || spaceKey;
  const includeAttachments = el.chkIncludeAttachments.checked;

  offlineExporterCancel = false;

  // Switch to progress view
  el.offlineFormView.classList.add('hidden');
  el.offlineProgressView.classList.remove('hidden');
  el.offlineSuccessView.classList.add('hidden');
  el.btnStartOfflineExport.classList.add('hidden');
  el.btnCancelOfflineExport.classList.remove('hidden');
  el.btnCloseOfflineExportDone.classList.add('hidden');

  setOfflineStep(1);
  el.offlineProgressBarFill.style.width = '5%';
  el.offlineProgressLabel.textContent = 'Đang khởi tạo tiến trình xuất offline...';

  try {
    const exporter = new OfflineSpaceExporter(state.client);
    const result = await exporter.exportSpace({
      spaceKey,
      spaceName,
      includeAttachments,
      throttleMs: state.throttleMs || 50,
      onProgress: (p) => {
        el.offlineProgressBarFill.style.width = `${p.percent}%`;
        el.offlineProgressLabel.textContent = p.currentText;

        if (p.stage === 'FETCHING_PAGES') {
          setOfflineStep(1);
        } else if (p.stage === 'BUILDING_TREE') {
          setOfflineStep(2);
        } else if (p.stage === 'FETCHING_ATTACHMENTS_LIST' || p.stage === 'DOWNLOADING_ASSETS') {
          setOfflineStep(3);
        } else if (p.stage === 'GENERATING_HTML' || p.stage === 'GENERATING_PORTAL' || p.stage === 'COMPRESSING') {
          setOfflineStep(4);
        }
      },
      isCancelled: () => offlineExporterCancel
    });

    // Trigger download of zip
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    // Switch to success view
    setOfflineStep(5);
    el.offlineProgressView.classList.add('hidden');
    el.offlineSuccessView.classList.remove('hidden');
    el.btnCancelOfflineExport.classList.add('hidden');
    el.btnCloseOfflineExportDone.classList.remove('hidden');

    el.offlineSuccessDesc.textContent = `Đã tải xuống thành công ${result.totalPages} trang và ${result.totalAttachments} tệp đính kèm.`;
  } catch (err) {
    if (offlineExporterCancel) {
      alert('Đã hủy tiến trình tải offline.');
    } else {
      alert(`Lỗi khi tải space offline: ${err.message}`);
    }
    // Return to form view
    el.offlineFormView.classList.remove('hidden');
    el.offlineProgressView.classList.add('hidden');
    el.btnStartOfflineExport.classList.remove('hidden');
    el.btnCancelOfflineExport.classList.add('hidden');
  }
}

function cancelOfflineExport() {
  offlineExporterCancel = true;
  el.offlineProgressLabel.textContent = 'Đang hủy...';
}
