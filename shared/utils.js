/**
 * ConScan - Utility Functions
 */

export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(isoString) {
  if (!isoString) return 'Không rõ';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return isoString;
  }
}

export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) {
      const diffMonth = Math.floor(diffDay / 30);
      return diffMonth > 12 ? `${Math.floor(diffMonth / 12)} năm trước` : `${diffMonth} tháng trước`;
    }
    if (diffDay > 0) return `${diffDay} ngày trước`;
    if (diffHour > 0) return `${diffHour} giờ trước`;
    if (diffMin > 0) return `${diffMin} phút trước`;
    return 'Vừa xong';
  } catch {
    return '';
  }
}

export function getFileCategory(filename = '', mediaType = '') {
  const ext = filename.split('.').pop().toLowerCase();

  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'];
  const docExts = ['doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md'];
  const sheetExts = ['xls', 'xlsx', 'csv', 'tsv', 'numbers', 'ods'];
  const slideExts = ['ppt', 'pptx', 'key', 'odp'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'php', 'rb', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sql', 'sh'];

  if (ext === 'pdf' || mediaType.includes('pdf')) return 'pdf';
  if (imageExts.includes(ext) || mediaType.startsWith('image/')) return 'image';
  if (sheetExts.includes(ext) || mediaType.includes('spreadsheet') || mediaType.includes('excel')) return 'spreadsheet';
  if (docExts.includes(ext) || mediaType.includes('word') || mediaType.includes('text/plain')) return 'document';
  if (slideExts.includes(ext) || mediaType.includes('presentation') || mediaType.includes('powerpoint')) return 'presentation';
  if (archiveExts.includes(ext) || mediaType.includes('zip') || mediaType.includes('tar')) return 'archive';
  if (codeExts.includes(ext) || mediaType.includes('json') || mediaType.includes('javascript')) return 'code';

  return 'other';
}

export function getFileBadgeInfo(category, ext) {
  const mapping = {
    pdf: { label: 'PDF', bg: '#fee2e2', text: '#b91c1c', icon: '📄' },
    image: { label: ext.toUpperCase() || 'IMG', bg: '#f3e8ff', text: '#7e22ce', icon: '🖼️' },
    spreadsheet: { label: ext.toUpperCase() || 'XLS', bg: '#dcfce7', text: '#15803d', icon: '📊' },
    document: { label: ext.toUpperCase() || 'DOC', bg: '#e0f2fe', text: '#0369a1', icon: '📝' },
    presentation: { label: ext.toUpperCase() || 'PPT', bg: '#ffedd5', text: '#c2410c', icon: '📑' },
    archive: { label: ext.toUpperCase() || 'ZIP', bg: '#fef3c7', text: '#b45309', icon: '📦' },
    code: { label: ext.toUpperCase() || 'CODE', bg: '#e2e8f0', text: '#334155', icon: '💻' },
    other: { label: ext.toUpperCase() || 'FILE', bg: '#f1f5f9', text: '#64748b', icon: '📎' }
  };
  return mapping[category] || mapping.other;
}

export function escapeCSV(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  return `"${str.replace(/"/g, '""')}"`;
}

export function exportToCSV(attachments, filename = 'confluence-attachments.csv') {
  const headers = [
    'Tên tệp',
    'Phân loại',
    'Space (Tên)',
    'Space Key',
    'Page',
    'Page ID',
    'Người Upload',
    'Username',
    'Thời điểm Upload (ISO)',
    'Thời điểm Upload',
    'Dung lượng (Bytes)',
    'Dung lượng',
    'Phiên bản',
    'Link Trang Confluence',
    'Link Tải Tệp'
  ];

  const rows = attachments.map((att) => [
    escapeCSV(att.filename),
    escapeCSV(att.category),
    escapeCSV(att.spaceName),
    escapeCSV(att.spaceKey),
    escapeCSV(att.pageTitle),
    escapeCSV(att.pageId),
    escapeCSV(att.uploadedBy),
    escapeCSV(att.uploadedByUsername),
    escapeCSV(att.uploadDate),
    escapeCSV(att.formattedDate),
    escapeCSV(att.fileSize),
    escapeCSV(att.formattedSize),
    escapeCSV(att.version),
    escapeCSV(att.pageUrl),
    escapeCSV(att.downloadUrl)
  ]);

  // UTF-8 BOM for Microsoft Excel Vietnamese compatibility
  const BOM = '\uFEFF';
  const csvContent = BOM + [headers.map(escapeCSV).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export function exportToJSON(attachments, filename = 'confluence-attachments.json') {
  const jsonContent = JSON.stringify(attachments, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
