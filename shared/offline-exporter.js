/**
 * ConScan - Offline Space Exporter
 * Downloads all pages of a Confluence Space following the exact folder/tree structure,
 * rewrites assets for offline viewing, and generates an interactive offline reader.
 */

import { SimpleZip } from './zip.js';
import { formatBytes, formatDate, getFileCategory, getFileBadgeInfo } from './utils.js';

export class OfflineSpaceExporter {
  constructor(apiClient) {
    this.client = apiClient;
  }

  /**
   * Export an entire space into an offline ZIP bundle
   */
  async exportSpace({
    spaceKey,
    spaceName = '',
    includeAttachments = true,
    throttleMs = 50,
    onProgress = () => {},
    isCancelled = () => false
  }) {
    const zip = new SimpleZip();
    const cleanSpaceName = sanitizeFilename(spaceName || spaceKey);
    const spaceRoot = cleanSpaceName;

    // 1. Fetch all pages in the space
    onProgress({
      stage: 'FETCHING_PAGES',
      percent: 5,
      currentText: `Đang quét toàn bộ trang trong không gian [${spaceKey}]...`
    });

    const rawPages = await this.client.getAllPagesInSpace(spaceKey, (p) => {
      onProgress({
        stage: 'FETCHING_PAGES',
        percent: Math.min(25, 5 + Math.round((p.loaded / 50) * 10)),
        currentText: `Đã tìm thấy ${p.loaded} trang...`
      });
    });

    if (isCancelled()) throw new Error('Đã hủy tải.');

    if (!rawPages || rawPages.length === 0) {
      throw new Error(`Không gian [${spaceKey}] không có trang nào hoặc bạn không có quyền xem.`);
    }

    // 2. Build page hierarchy and compute relative directory paths
    onProgress({
      stage: 'BUILDING_TREE',
      percent: 28,
      currentText: `Đang xây dựng cấu trúc cây thư mục (${rawPages.length} trang)...`
    });

    const pageMap = new Map(); // id -> node
    rawPages.forEach((p) => {
      pageMap.set(p.id, {
        id: p.id,
        title: p.title || `Page_${p.id}`,
        safeTitle: sanitizeFilename(p.title || `Page_${p.id}`),
        ancestors: p.ancestors || [],
        raw: p,
        children: [],
        dirPath: '',
        htmlPath: '',
        attachments: []
      });
    });

    // Determine parent-child links and build safe paths
    const rootNodes = [];
    pageMap.forEach((node) => {
      const parentAncestor = node.ancestors.filter((a) => pageMap.has(a.id)).pop();
      if (parentAncestor) {
        const parentNode = pageMap.get(parentAncestor.id);
        parentNode.children.push(node);
        node.parent = parentNode;
      } else {
        rootNodes.push(node);
      }
    });

    // Compute relative paths recursively
    function computePaths(nodeList, parentPath) {
      const usedNames = new Set();
      nodeList.forEach((node) => {
        let name = node.safeTitle;
        if (usedNames.has(name.toLowerCase())) {
          name = `${name}_${node.id}`;
        }
        usedNames.add(name.toLowerCase());
        node.folderName = name;

        // Path of folder
        node.dirPath = parentPath ? `${parentPath}/${name}` : `${spaceRoot}/${name}`;
        node.htmlPath = `${node.dirPath}/index.html`;

        if (node.children.length > 0) {
          computePaths(node.children, node.dirPath);
        }
      });
    }

    computePaths(rootNodes, '');

    // 3. Fetch attachments if requested
    let totalAttachments = 0;
    let fetchedAttachments = 0;

    if (includeAttachments) {
      onProgress({
        stage: 'FETCHING_ATTACHMENTS_LIST',
        percent: 32,
        currentText: 'Đang kiểm tra danh sách tệp đính kèm và hình ảnh...'
      });

      for (let i = 0; i < rawPages.length; i++) {
        if (isCancelled()) throw new Error('Đã hủy tải.');
        const pageId = rawPages[i].id;
        const node = pageMap.get(pageId);

        try {
          const attResp = await this.client.getPageAttachments(pageId, 0, 100);
          const attList = attResp.attachments || [];
          node.attachments = attList;
          totalAttachments += attList.length;
        } catch {
          // Ignore attachment listing error
        }

        if (throttleMs > 0 && i % 5 === 0) {
          await new Promise((r) => setTimeout(r, throttleMs));
        }
      }

      onProgress({
        stage: 'DOWNLOADING_ASSETS',
        percent: 38,
        currentText: `Bắt đầu tải ${totalAttachments} tệp đính kèm & hình ảnh...`
      });

      // Download binary assets for each page
      for (const node of pageMap.values()) {
        if (isCancelled()) throw new Error('Đã hủy tải.');

        for (const att of node.attachments) {
          if (isCancelled()) throw new Error('Đã hủy tải.');
          if (!att.downloadUrl) continue;

          const safeFilename = sanitizeFilename(att.filename || 'attachment');
          const attZipPath = `${node.dirPath}/attachments/${safeFilename}`;
          att.localFilename = safeFilename;
          att.localRelativePath = `./attachments/${safeFilename}`;

          try {
            const dataUrl = await this.client.requestBinary(att.downloadUrl);
            zip.addBase64File(attZipPath, dataUrl);
            fetchedAttachments++;

            const pct = 38 + Math.round((fetchedAttachments / Math.max(1, totalAttachments)) * 32);
            onProgress({
              stage: 'DOWNLOADING_ASSETS',
              percent: Math.min(70, pct),
              currentText: `Đang tải tệp: ${att.filename} (${fetchedAttachments}/${totalAttachments})...`
            });
          } catch (err) {
            console.warn(`Không thể tải tệp ${att.filename}:`, err);
          }

          if (throttleMs > 0) {
            await new Promise((r) => setTimeout(r, throttleMs));
          }
        }
      }
    }

    // 4. Generate HTML for each page
    onProgress({
      stage: 'GENERATING_HTML',
      percent: 72,
      currentText: 'Đang tạo giao diện HTML hoạt động offline cho từng trang...'
    });

    let generatedPages = 0;
    for (const node of pageMap.values()) {
      if (isCancelled()) throw new Error('Đã hủy tải.');

      const pageHtml = renderOfflinePageHtml({
        node,
        spaceKey,
        spaceName,
        pageMap,
        spaceRoot
      });

      zip.addFile(node.htmlPath, pageHtml);
      generatedPages++;

      const pct = 72 + Math.round((generatedPages / rawPages.length) * 15);
      onProgress({
        stage: 'GENERATING_HTML',
        percent: Math.min(88, pct),
        currentText: `Đã đóng gói trang: ${node.title} (${generatedPages}/${rawPages.length})...`
      });
    }

    // 5. Generate Master Interactive Viewer (index.html at root)
    onProgress({
      stage: 'GENERATING_PORTAL',
      percent: 90,
      currentText: 'Đang tạo cổng duyệt tương tác (Interactive Offline Viewer)...'
    });

    const masterPortalHtml = renderMasterPortalHtml({
      spaceKey,
      spaceName,
      rootNodes,
      allNodes: Array.from(pageMap.values()),
      spaceRoot
    });

    zip.addFile(`${spaceRoot}/index.html`, masterPortalHtml);

    // Add offline CSS file for shared styling
    zip.addFile(`${spaceRoot}/offline-styles.css`, getOfflineCSS());

    // 6. Generate ZIP Archive
    onProgress({
      stage: 'COMPRESSING',
      percent: 94,
      currentText: 'Đang nén dữ liệu thành file ZIP...'
    });

    const blob = await zip.generateBlob(true);

    onProgress({
      stage: 'COMPLETED',
      percent: 100,
      currentText: `✅ Đã tạo gói offline thành công! Kích thước: ${formatBytes(blob.size)}.`
    });

    return {
      blob,
      filename: `${cleanSpaceName}_Offline_Pages.zip`,
      totalPages: rawPages.length,
      totalAttachments: fetchedAttachments
    };
  }
}

// ---------------- Helpers & Sanitization ---------------- //

function sanitizeFilename(name) {
  if (!name) return 'Untitled';
  return name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/[\s\t\n]+/g, ' ')
    .slice(0, 80)
    .trim() || 'Page';
}

function getRelativePath(fromDir, toFile) {
  const fromParts = fromDir.split('/').filter(Boolean);
  const toParts = toFile.split('/').filter(Boolean);

  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }

  const upHops = fromParts.length - common;
  const rel = [];
  for (let i = 0; i < upHops; i++) {
    rel.push('..');
  }
  rel.push(...toParts.slice(common));

  return rel.join('/') || './';
}

// ---------------- HTML Renderers ---------------- //

function renderOfflinePageHtml({ node, spaceKey, spaceName, pageMap, spaceRoot }) {
  const p = node.raw;
  let rawBody = p.body?.export_view?.value || p.body?.view?.value || p.body?.storage?.value || '<p>Không có nội dung.</p>';

  // Rewrite attachment and image links to local offline paths
  if (node.attachments && node.attachments.length > 0) {
    node.attachments.forEach((att) => {
      if (att.localRelativePath) {
        // Replace occurrences of download link or filename
        const filename = att.filename;
        const encFilename = encodeURIComponent(filename);

        // Pattern 1: Confluence download url
        const regex1 = new RegExp(`(/wiki)?/download/attachments/${p.id}/[^"'>\\s]+`, 'g');
        rawBody = rawBody.replace(regex1, (match) => {
          if (match.includes(encFilename) || match.includes(filename)) {
            return att.localRelativePath;
          }
          return match;
        });

        // Pattern 2: direct filename references in data attributes or src
        const regex2 = new RegExp(`src="[^"]*${escapeRegExp(encFilename)}[^"]*"`, 'g');
        rawBody = rawBody.replace(regex2, `src="${att.localRelativePath}"`);

        const regex3 = new RegExp(`href="[^"]*${escapeRegExp(encFilename)}[^"]*"`, 'g');
        rawBody = rawBody.replace(regex3, `href="${att.localRelativePath}"`);
      }
    });
  }

  // Rewrite links to other pages in the same space to point to their local relative index.html
  pageMap.forEach((targetNode) => {
    if (targetNode.id !== node.id) {
      const relToTarget = getRelativePath(node.dirPath, targetNode.htmlPath);
      // Replace /pages/{targetId} or /pages/viewpage.action?pageId={targetId}
      const pageLinkRegex = new RegExp(`href="[^"]*(/pages/${targetNode.id}|pageId=${targetNode.id})[^"]*"`, 'g');
      rawBody = rawBody.replace(pageLinkRegex, `href="${relToTarget}"`);
    }
  });

  // Calculate relative path back to Space root for CSS and Portal
  const relToRoot = getRelativePath(node.dirPath, `${spaceRoot}/index.html`);
  const relToCss = getRelativePath(node.dirPath, `${spaceRoot}/offline-styles.css`);

  // Build breadcrumb
  const breadcrumbItems = [];
  breadcrumbItems.push(`<a href="${relToRoot}">🏠 ${escapeHtml(spaceName || spaceKey)}</a>`);

  let curr = node.parent;
  const ancestorNodes = [];
  while (curr) {
    ancestorNodes.unshift(curr);
    curr = curr.parent;
  }

  ancestorNodes.forEach((anc) => {
    const relToAnc = getRelativePath(node.dirPath, anc.htmlPath);
    breadcrumbItems.push(`<a href="${relToAnc}">${escapeHtml(anc.title)}</a>`);
  });
  breadcrumbItems.push(`<span>${escapeHtml(node.title)}</span>`);

  // Metadata
  const authorName = p.version?.by?.displayName || p.history?.createdBy?.displayName || 'Không rõ';
  const updatedDate = formatDate(p.version?.when || p.history?.createdDate);
  const versionNum = p.version?.number || 1;

  // Render attachments section if any
  let attachmentsSection = '';
  if (node.attachments && node.attachments.length > 0) {
    const attRows = node.attachments
      .map((att) => {
        const badge = getFileBadgeInfo(getFileCategory(att.filename), att.extension);
        return `
        <div class="offline-att-item">
          <span class="offline-att-badge" style="background:${badge.bg}; color:${badge.text};">${badge.label}</span>
          <a href="${att.localRelativePath || '#'}" download="${escapeHtml(att.filename)}" class="offline-att-name">
            ${escapeHtml(att.filename)}
          </a>
          <span class="offline-att-size">${formatBytes(att.fileSize)}</span>
          <a href="${att.localRelativePath || '#'}" download="${escapeHtml(att.filename)}" class="offline-att-dl">Tải về ⬇️</a>
        </div>
      `;
      })
      .join('');

    attachmentsSection = `
      <section class="offline-attachments-box">
        <h3 class="offline-attachments-title">📎 Tệp đính kèm (${node.attachments.length})</h3>
        <div class="offline-attachments-list">
          ${attRows}
        </div>
      </section>
    `;
  }

  // Children pages section if any
  let childrenSection = '';
  if (node.children && node.children.length > 0) {
    const childLinks = node.children
      .map((ch) => {
        const relToChild = getRelativePath(node.dirPath, ch.htmlPath);
        return `<li><a href="${relToChild}">📄 ${escapeHtml(ch.title)}</a></li>`;
      })
      .join('');

    childrenSection = `
      <div class="offline-subpages-box">
        <h4>Trang con thuộc mục này:</h4>
        <ul>${childLinks}</ul>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(node.title)} - ${escapeHtml(spaceName || spaceKey)}</title>
  <link rel="stylesheet" href="${relToCss}">
</head>
<body class="offline-page-body">
  <div class="offline-top-nav">
    <div class="offline-breadcrumb">${breadcrumbItems.join(' <span class="sep">/</span> ')}</div>
    <div class="offline-nav-actions">
      <a href="${relToRoot}" class="btn-portal">📚 Mở Cây Thư Mục</a>
    </div>
  </div>

  <main class="offline-article-container">
    <header class="offline-page-header">
      <h1 class="offline-page-title">${escapeHtml(node.title)}</h1>
      <div class="offline-page-meta">
        <span>👤 Người cập nhật: <strong>${escapeHtml(authorName)}</strong></span>
        <span>🕒 Cập nhật: <strong>${escapeHtml(updatedDate)}</strong></span>
        <span>🔢 Phiên bản: <strong>v${versionNum}</strong></span>
      </div>
    </header>

    <div class="offline-content-body wiki-content">
      ${rawBody}
    </div>

    ${childrenSection}
    ${attachmentsSection}
  </main>
</body>
</html>`;
}

function renderMasterPortalHtml({ spaceKey, spaceName, rootNodes, allNodes, spaceRoot }) {
  // Render sidebar recursive tree
  function renderTree(nodes) {
    if (!nodes || nodes.length === 0) return '';
    let html = '<ul class="portal-tree-list">';
    nodes.forEach((n) => {
      const relPath = getRelativePath(spaceRoot, n.htmlPath);
      const hasChildren = n.children && n.children.length > 0;
      html += `
        <li class="portal-tree-item" data-title="${escapeHtml(n.title.toLowerCase())}">
          <div class="portal-tree-row">
            ${hasChildren ? '<span class="toggle-icon">▼</span>' : '<span class="leaf-icon">•</span>'}
            <a href="${relPath}" target="contentFrame" class="portal-tree-link" data-path="${relPath}">
              📄 ${escapeHtml(n.title)}
            </a>
          </div>
          ${hasChildren ? renderTree(n.children) : ''}
        </li>
      `;
    });
    html += '</ul>';
    return html;
  }

  const treeHtml = renderTree(rootNodes);
  const defaultPage = rootNodes[0] ? getRelativePath(spaceRoot, rootNodes[0].htmlPath) : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(spaceName || spaceKey)} - Cổng Duyệt Offline</title>
  <link rel="stylesheet" href="offline-styles.css">
  <style>
    body {
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .portal-header {
      height: 54px;
      background: #0052CC;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }
    .portal-title {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .portal-badge {
      background: rgba(255,255,255,0.25);
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
    }
    .portal-layout {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .portal-sidebar {
      width: 340px;
      background: #F4F5F7;
      border-right: 1px solid #DFE1E6;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .portal-search-box {
      padding: 12px;
      border-bottom: 1px solid #DFE1E6;
      background: white;
    }
    .portal-search-input {
      width: 100%;
      padding: 8px 12px;
      box-sizing: border-box;
      border: 1px solid #DFE1E6;
      border-radius: 6px;
      font-size: 13px;
      outline: none;
    }
    .portal-tree-container {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }
    .portal-tree-list {
      list-style: none;
      padding-left: 16px;
      margin: 0;
    }
    .portal-sidebar > .portal-tree-container > .portal-tree-list {
      padding-left: 0;
    }
    .portal-tree-item {
      margin: 3px 0;
    }
    .portal-tree-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .portal-tree-row:hover {
      background: #EBECF0;
    }
    .portal-tree-row.active {
      background: #DEEBFF;
      color: #0052CC;
      font-weight: 600;
    }
    .toggle-icon {
      font-size: 9px;
      color: #7A869A;
      width: 14px;
      text-align: center;
      cursor: pointer;
      user-select: none;
    }
    .leaf-icon {
      color: #C1C7D0;
      width: 14px;
      text-align: center;
      font-size: 14px;
    }
    .portal-tree-link {
      color: #172B4D;
      text-decoration: none;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .portal-viewer {
      flex: 1;
      background: white;
      display: flex;
      flex-direction: column;
    }
    .portal-iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <header class="portal-header">
    <div class="portal-title">
      <span>📚 ${escapeHtml(spaceName || spaceKey)}</span>
      <span class="portal-badge">${spaceKey}</span>
      <span class="portal-badge">${allNodes.length} trang</span>
    </div>
    <div style="font-size:12px; opacity:0.9;">
      Chế độ duyệt Offline • Tải từ ConScan
    </div>
  </header>

  <div class="portal-layout">
    <aside class="portal-sidebar">
      <div class="portal-search-box">
        <input type="text" id="searchInput" class="portal-search-input" placeholder="🔍 Tìm trang trong space...">
      </div>
      <div class="portal-tree-container" id="treeContainer">
        ${treeHtml}
      </div>
    </aside>

    <main class="portal-viewer">
      <iframe src="${defaultPage}" name="contentFrame" id="contentFrame" class="portal-iframe"></iframe>
    </main>
  </div>

  <script>
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.portal-tree-item').forEach(item => {
        const title = item.dataset.title || '';
        if (!q || title.includes(q)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });

    // Expand / collapse tree nodes
    document.querySelectorAll('.toggle-icon').forEach(icon => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = icon.closest('.portal-tree-item');
        const subList = item.querySelector(':scope > .portal-tree-list');
        if (subList) {
          if (subList.style.display === 'none') {
            subList.style.display = '';
            icon.textContent = '▼';
          } else {
            subList.style.display = 'none';
            icon.textContent = '▶';
          }
        }
      });
    });

    // Highlight active page link
    document.querySelectorAll('.portal-tree-link').forEach(link => {
      link.addEventListener('click', () => {
        document.querySelectorAll('.portal-tree-row').forEach(r => r.classList.remove('active'));
        link.closest('.portal-tree-row')?.classList.add('active');
      });
    });
  </script>
</body>
</html>`;
}

function getOfflineCSS() {
  return `/* ConScan Offline Stylesheet */
:root {
  --primary: #0052CC;
  --text-main: #172B4D;
  --text-sub: #5E6C84;
  --border: #DFE1E6;
  --bg-page: #FFFFFF;
}

body.offline-page-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  color: var(--text-main);
  background-color: var(--bg-page);
  line-height: 1.6;
  margin: 0;
  padding: 0;
}

.offline-top-nav {
  background: #FAFBFC;
  border-bottom: 1px solid var(--border);
  padding: 10px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.offline-breadcrumb a {
  color: var(--primary);
  text-decoration: none;
}

.offline-breadcrumb a:hover {
  text-decoration: underline;
}

.offline-breadcrumb .sep {
  margin: 0 6px;
  color: #7A869A;
}

.btn-portal {
  background: #EBECF0;
  color: var(--text-main);
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}

.offline-article-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 60px;
}

.offline-page-header {
  border-bottom: 1px solid var(--border);
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.offline-page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 10px;
  color: var(--text-main);
}

.offline-page-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-sub);
  flex-wrap: wrap;
}

/* Confluence Wiki Content Styling */
.wiki-content {
  font-size: 15px;
  line-height: 1.65;
}

.wiki-content h1, .wiki-content h2, .wiki-content h3 {
  color: var(--text-main);
  margin-top: 24px;
  margin-bottom: 12px;
}

.wiki-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.wiki-content th, .wiki-content td {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
}

.wiki-content th {
  background: #F4F5F7;
  font-weight: 600;
}

.wiki-content img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 12px 0;
  border: 1px solid var(--border);
}

.wiki-content pre, .wiki-content code {
  background: #F4F5F7;
  border-radius: 4px;
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
}

.wiki-content pre {
  padding: 12px;
  overflow-x: auto;
  border: 1px solid var(--border);
}

.wiki-content blockquote {
  border-left: 4px solid var(--primary);
  margin: 16px 0;
  padding: 8px 16px;
  background: #F4F5F7;
}

/* Attachments Box */
.offline-attachments-box {
  margin-top: 40px;
  background: #FAFBFC;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 18px 20px;
}

.offline-attachments-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.offline-attachments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.offline-att-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border: 1px solid var(--border);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.offline-att-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.offline-att-name {
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
  flex: 1;
}

.offline-att-size {
  color: var(--text-sub);
  font-size: 12px;
}

.offline-att-dl {
  color: var(--text-main);
  text-decoration: none;
  background: #EBECF0;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.offline-subpages-box {
  margin-top: 30px;
  background: #F4F5F7;
  padding: 16px 20px;
  border-radius: 6px;
}
.offline-subpages-box h4 {
  margin: 0 0 8px;
  font-size: 14px;
}
.offline-subpages-box ul {
  margin: 0;
  padding-left: 20px;
}
.offline-subpages-box li {
  margin: 4px 0;
}
.offline-subpages-box a {
  color: var(--primary);
  text-decoration: none;
}
`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
