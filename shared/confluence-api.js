/**
 * ConScan - Confluence API Client
 * Supports both Confluence Cloud and Server/Data Center.
 * Operates seamlessly via active browser session or direct token.
 */

import { formatBytes, formatDate, formatRelativeTime, getFileCategory } from './utils.js';

export class ConfluenceApiClient {
  constructor({ baseUrl = '', tabId = null, apiToken = '', username = '' } = {}) {
    this.tabId = tabId;
    this.apiToken = apiToken;
    this.username = username;
    this.restBase = '';
    this.apiBaseUrl = '';
    this.setBaseUrl(baseUrl);
  }

  setTabId(tabId) {
    this.tabId = tabId;
  }

  setBaseUrl(baseUrl) {
    if (!baseUrl) {
      this.baseUrl = '';
      this.restBase = '';
      return;
    }
    let clean = baseUrl.replace(/\/+$/, '');
    // Ensure Atlassian Cloud domains always include /wiki
    if (clean.includes('atlassian.net') && !clean.endsWith('/wiki')) {
      clean += '/wiki';
    }
    this.baseUrl = clean;
    this.restBase = '';
  }

  /**
   * Universal fetch: dispatches via content script if tabId exists, else direct fetch
   */
  async request(endpoint, options = {}) {
    let fullUrl = endpoint;
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      const base = this.restBase || (this.baseUrl ? `${this.baseUrl}/rest/api` : '');
      fullUrl = `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }

    // Tab-based execution (Uses active session cookies effortlessly)
    if (this.tabId) {
      const response = await chrome.runtime.sendMessage({
        action: 'FETCH_CONFLUENCE_API',
        tabId: this.tabId,
        url: fullUrl,
        options
      });

      if (!response) {
        throw new Error('Không nhận được phản hồi từ tab Confluence. Hãy kiểm tra tab còn mở không.');
      }

      if (!response.success) {
        const errMsg = response.data?.message || response.error || `HTTP ${response.status}: ${response.statusText}`;
        const err = new Error(errMsg);
        err.status = response.status;
        err.data = response.data;
        throw err;
      }

      return response.data;
    }

    // Direct fetch (When user provides URL & optional API token)
    const headers = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'no-check',
      ...(options.headers || {})
    };

    if (this.apiToken) {
      if (this.username) {
        const credentials = btoa(`${this.username}:${this.apiToken}`);
        headers['Authorization'] = `Basic ${credentials}`;
      } else {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      }
    }

    const res = await fetch(fullUrl, {
      method: options.method || 'GET',
      headers,
      credentials: 'include',
      body: options.body
    });

    if (!res.ok) {
      let errBody;
      try {
        errBody = await res.json();
      } catch {
        errBody = await res.text();
      }
      const errMsg = errBody?.message || errBody?.errorMessages?.join(', ') || `HTTP ${res.status}: ${res.statusText}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.data = errBody;
      throw err;
    }

    return await res.json();
  }

  /**
   * Fetch binary asset (image, attachment) as Data URL
   */
  async requestBinary(endpoint, options = {}) {
    let fullUrl = endpoint;
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      const base = this.restBase || (this.baseUrl ? `${this.baseUrl}/rest/api` : '');
      fullUrl = `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    }

    if (this.tabId) {
      const response = await chrome.runtime.sendMessage({
        action: 'FETCH_CONFLUENCE_BINARY',
        tabId: this.tabId,
        url: fullUrl,
        options
      });

      if (!response || !response.success) {
        throw new Error(response?.error || `Không thể tải file: ${fullUrl}`);
      }

      return response.dataUrl;
    }

    // Direct fetch
    const headers = { ...(options.headers || {}) };
    if (this.apiToken) {
      if (this.username) {
        headers['Authorization'] = `Basic ${btoa(`${this.username}:${this.apiToken}`)}`;
      } else {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      }
    }

    const res = await fetch(fullUrl, {
      method: options.method || 'GET',
      headers,
      credentials: 'include'
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Fetch all pages in a space with ancestors and full content body
   */
  async getAllPagesInSpace(spaceKey, onProgress = null) {
    if (!this.restBase) await this.detectApiBase();

    const allPages = [];
    let start = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const endpoint = `/space/${encodeURIComponent(spaceKey)}/content/page?limit=${limit}&start=${start}&expand=ancestors,body.view,body.export_view,version,history,metadata`;
      const data = await this.request(endpoint);
      const batch = data.results || [];

      for (const p of batch) {
        allPages.push(p);
      }

      if (onProgress) {
        onProgress({ loaded: allPages.length });
      }

      if (batch.length < limit || !data._links?.next) {
        hasMore = false;
      } else {
        start += limit;
      }
    }

    return allPages;
  }

  /**
   * Fetch lightweight pages overview for space preview (without heavy HTML body)
   */
  async getSpacePagesOverview(spaceKey, onProgress = null) {
    if (!this.restBase) await this.detectApiBase();

    const pages = [];
    let start = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const endpoint = `/space/${encodeURIComponent(spaceKey)}/content/page?limit=${limit}&start=${start}&expand=ancestors,version,history,metadata`;
      const data = await this.request(endpoint);
      const batch = data.results || [];

      for (const p of batch) {
        pages.push({
          id: p.id,
          title: p.title,
          ancestors: p.ancestors || [],
          version: p.version?.number || 1,
          updatedBy: p.version?.by?.displayName || p.history?.createdBy?.displayName || '',
          updatedDate: p.version?.when || p.history?.createdDate || ''
        });
      }

      if (onProgress) {
        onProgress({ loaded: pages.length });
      }

      if (batch.length < limit || !data._links?.next) {
        hasMore = false;
      } else {
        start += limit;
      }
    }

    return pages;
  }

  /**
   * Probe and detect whether REST API is at /wiki/rest/api or /rest/api
   */
  async detectApiBase() {
    if (!this.baseUrl) throw new Error('Chưa thiết lập Confluence Base URL');

    const cleanBase = this.baseUrl.replace(/\/+$/, '');
    const candidates = [];

    if (cleanBase.endsWith('/wiki')) {
      candidates.push(`${cleanBase}/rest/api`);
      candidates.push(`${cleanBase.replace(/\/wiki$/, '')}/rest/api`);
    } else {
      candidates.push(`${cleanBase}/wiki/rest/api`);
      candidates.push(`${cleanBase}/rest/api`);
    }

    for (const cand of candidates) {
      try {
        const testUrl = `${cand}/space?limit=1`;
        let ok = false;
        if (this.tabId) {
          const resp = await chrome.runtime.sendMessage({
            action: 'FETCH_CONFLUENCE_API',
            tabId: this.tabId,
            url: testUrl,
            options: { method: 'GET' }
          });
          ok = resp && resp.success;
        } else {
          const res = await fetch(testUrl, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
          });
          ok = res.ok;
        }

        if (ok) {
          this.restBase = cand;
          if (cand.includes('/wiki') && !this.baseUrl.endsWith('/wiki')) {
            this.baseUrl = this.baseUrl.replace(/\/+$/, '') + '/wiki';
          }
          return cand;
        }
      } catch {
        // Continue trying next candidate
      }
    }

    // Default fallback
    this.restBase = candidates[0];
    if (this.restBase.includes('/wiki') && !this.baseUrl.endsWith('/wiki')) {
      this.baseUrl = this.baseUrl.replace(/\/+$/, '') + '/wiki';
    }
    return this.restBase;
  }

  /**
   * Fetch all spaces accessible by the user
   */
  async getSpaces(onProgress = null) {
    if (!this.restBase) await this.detectApiBase();

    const spaces = [];
    let start = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const endpoint = `/space?limit=${limit}&start=${start}&status=current`;
      const data = await this.request(endpoint);
      const batch = data.results || [];

      for (const item of batch) {
        spaces.push({
          id: item.id,
          key: item.key,
          name: item.name,
          type: item.type,
          url: this.buildWebUrl(item._links?.webui || `/spaces/${item.key}`),
          icon: item.icon?.path ? this.buildWebUrl(item.icon.path) : ''
        });
      }

      if (onProgress) {
        onProgress({ loaded: spaces.length, batchCount: batch.length });
      }

      if (batch.length < limit || !data._links?.next) {
        hasMore = false;
      } else {
        start += limit;
      }
    }

    // Sort spaces alphabetically by name
    spaces.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return spaces;
  }

  /**
   * Query attachments via Confluence Query Language (CQL)
   */
  async searchAttachmentsCQL({
    spaceKeys = [],
    query = '',
    dateFrom = '',
    dateTo = '',
    start = 0,
    limit = 50
  } = {}) {
    if (!this.restBase) await this.detectApiBase();

    // Construct CQL
    const cqlParts = ['type = attachment'];

    if (spaceKeys && spaceKeys.length > 0) {
      const formattedKeys = spaceKeys.map((k) => `"${k}"`).join(',');
      cqlParts.push(`space in (${formattedKeys})`);
    }

    if (dateFrom) {
      cqlParts.push(`created >= "${dateFrom}"`);
    }
    if (dateTo) {
      cqlParts.push(`created <= "${dateTo}"`);
    }

    if (query) {
      cqlParts.push(`(title ~ "${query}*" or text ~ "${query}")`);
    }

    const cql = cqlParts.join(' and ') + ' order by created desc';
    const endpoint = `/content/search?cql=${encodeURIComponent(cql)}&start=${start}&limit=${limit}&expand=version,history,space,container,metadata`;

    const data = await this.request(endpoint);
    if (data._links?.base) {
      this.apiBaseUrl = data._links.base.replace(/\/+$/, '');
    }
    const results = (data.results || []).map((item) => this.normalizeAttachment(item, null, data._links));

    return {
      results,
      start: data.start || start,
      limit: data.limit || limit,
      size: data.size || results.length,
      totalSize: data.totalSize,
      hasMore: !!data._links?.next || results.length === limit
    };
  }

  /**
   * Fallback: Get pages in space
   */
  async getSpacePages(spaceKey, start = 0, limit = 50) {
    if (!this.restBase) await this.detectApiBase();
    const endpoint = `/space/${encodeURIComponent(spaceKey)}/content?type=page&limit=${limit}&start=${start}`;
    const data = await this.request(endpoint);
    return {
      pages: data.page?.results || [],
      hasMore: !!data.page?._links?.next
    };
  }

  /**
   * Fallback: Get attachments for a single page
   */
  async getPageAttachments(pageId, start = 0, limit = 50) {
    if (!this.restBase) await this.detectApiBase();
    const endpoint = `/content/${pageId}/child/attachment?limit=${limit}&start=${start}&expand=version,history,container`;
    const data = await this.request(endpoint);
    if (data._links?.base) {
      this.apiBaseUrl = data._links.base.replace(/\/+$/, '');
    }
    return {
      attachments: (data.results || []).map((item) => this.normalizeAttachment(item, null, data._links)),
      hasMore: !!data._links?.next
    };
  }

  /**
   * Normalize attachment object from Confluence REST response
   */
  normalizeAttachment(item, fallbackSpace = null, apiLinks = null) {
    const spaceKey = item.space?.key || fallbackSpace?.key || 'UNKNOWN';
    const spaceName = item.space?.name || fallbackSpace?.name || spaceKey;

    const container = item.container || {};
    const pageId = container.id || '';
    const pageTitle = container.title || 'Không có tiêu đề trang';
    const pageWebui = container._links?.webui || '';

    const history = item.history || {};
    const version = item.version || {};
    const extensions = item.extensions || {};

    const linksContext = apiLinks || item._links;

    // Creator / Uploader determination
    const creatorObj = history.createdBy || version.by || {};
    const uploadedBy = creatorObj.displayName || creatorObj.publicName || creatorObj.username || 'Không xác định';
    const uploadedByUsername = creatorObj.username || creatorObj.accountId || '';
    const uploaderAvatar = creatorObj.profilePicture?.path ? this.buildWebUrl(creatorObj.profilePicture.path, linksContext) : '';

    const uploadDate = version.when || history.createdDate || item.metadata?.createdDate || '';
    const fileSize = parseInt(extensions.fileSize || item.metadata?.fileSize || 0, 10);
    const mediaType = extensions.mediaType || extensions.contentType || '';

    const filename = item.title || 'attachment';
    const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
    const category = getFileCategory(filename, mediaType);

    const downloadPath = item._links?.download || '';
    const webuiPath = item._links?.webui || downloadPath;

    return {
      id: item.id || Math.random().toString(36).substring(2),
      filename,
      extension: ext,
      category,
      spaceKey,
      spaceName,
      pageId,
      pageTitle,
      pageUrl: pageWebui ? this.buildWebUrl(pageWebui, linksContext) : '',
      uploadedBy,
      uploadedByUsername,
      uploaderAvatar,
      uploadDate,
      formattedDate: formatDate(uploadDate),
      relativeTime: formatRelativeTime(uploadDate),
      fileSize,
      formattedSize: formatBytes(fileSize),
      version: version.number || 1,
      comment: version.message || extensions.comment || '',
      downloadUrl: downloadPath ? this.buildWebUrl(downloadPath, linksContext) : '',
      viewUrl: webuiPath ? this.buildWebUrl(webuiPath, linksContext) : ''
    };
  }

  buildWebUrl(path, apiLinks = null) {
    if (!path) return '';

    // Check if this instance uses /wiki context
    const usesWiki =
      (this.apiBaseUrl && this.apiBaseUrl.includes('/wiki')) ||
      (this.restBase && this.restBase.includes('/wiki')) ||
      (this.baseUrl && this.baseUrl.includes('/wiki')) ||
      (this.baseUrl && this.baseUrl.includes('atlassian.net')) ||
      (apiLinks?.base && apiLinks.base.includes('/wiki')) ||
      (apiLinks?.context === '/wiki');

    // Case 1: Absolute URL starting with http:// or https://
    if (path.startsWith('http://') || path.startsWith('https://')) {
      try {
        const u = new URL(path);
        // If it's an Atlassian Cloud or wiki instance, and path is missing /wiki prefix
        if (usesWiki && !u.pathname.startsWith('/wiki/') && u.pathname !== '/wiki') {
          u.pathname = '/wiki' + (u.pathname.startsWith('/') ? '' : '/') + u.pathname;
          return u.toString();
        }
      } catch {}
      return path;
    }

    // Determine the base origin
    let base = this.apiBaseUrl || this.baseUrl || '';
    let origin = '';
    try {
      if (base.startsWith('http://') || base.startsWith('https://')) {
        const u = new URL(base);
        origin = u.origin;
      }
    } catch {}

    if (!origin) {
      origin = base.replace(/\/wiki.*$/, '').replace(/\/+$/, '');
    }

    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    if (usesWiki) {
      // If path already starts with /wiki/, attach to origin directly
      if (cleanPath.startsWith('/wiki/') || cleanPath === '/wiki') {
        return `${origin}${cleanPath}`;
      }
      // Otherwise prepend /wiki
      return `${origin}/wiki${cleanPath}`;
    }

    // Default for Confluence Server / Data Center without /wiki
    return `${base.replace(/\/+$/, '')}${cleanPath}`;
  }
}
