/**
 * ConScan - Lightweight In-Browser PKZIP Generator
 * Zero external dependencies.
 * Uses native browser CompressionStream('deflate-raw') when available.
 * Supports UTF-8 filenames, nested folder hierarchies, and binary files.
 */

export class SimpleZip {
  constructor() {
    this.files = [];
  }

  // Precomputed CRC32 table for high performance
  static crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  })();

  static crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ SimpleZip.crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  /**
   * Add a file to the ZIP archive
   * @param {string} path - Relative path inside ZIP (e.g. "Space/Parent/Child/page.html")
   * @param {string|Uint8Array|ArrayBuffer} content - File content
   */
  addFile(path, content) {
    let data;
    if (typeof content === 'string') {
      data = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      data = content;
    } else if (content instanceof ArrayBuffer) {
      data = new Uint8Array(content);
    } else {
      data = new Uint8Array(0);
    }

    // Normalize path: forward slashes, strip leading slash
    const normPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
    this.files.push({ path: normPath, data });
  }

  /**
   * Add a file from a Base64 string or Data URL
   */
  addBase64File(path, base64OrDataUrl) {
    let rawBase64 = base64OrDataUrl;
    if (base64OrDataUrl.includes(',')) {
      rawBase64 = base64OrDataUrl.split(',')[1];
    }
    const binaryStr = atob(rawBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    this.addFile(path, bytes);
  }

  /**
   * Generate ZIP archive as Uint8Array
   * @param {boolean} useCompression - Whether to compress files using DEFLATE
   */
  async generateUint8Array(useCompression = true) {
    const fileEntries = [];
    let offset = 0;

    for (const file of this.files) {
      const pathBytes = new TextEncoder().encode(file.path);
      const uncompressedSize = file.data.length;
      const crc = SimpleZip.crc32(file.data);

      let compressedData = file.data;
      let compressionMethod = 0; // Stored (no compression)

      if (useCompression && typeof CompressionStream !== 'undefined' && uncompressedSize > 0) {
        try {
          const cs = new CompressionStream('deflate-raw');
          const writer = cs.writable.getWriter();
          writer.write(file.data);
          writer.close();

          const chunks = [];
          const reader = cs.readable.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
          }

          const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
          const compBuf = new Uint8Array(totalLen);
          let pos = 0;
          for (const c of chunks) {
            compBuf.set(c, pos);
            pos += c.length;
          }

          // Only use deflate if it actually reduces size
          if (compBuf.length < uncompressedSize) {
            compressedData = compBuf;
            compressionMethod = 8; // Deflate
          }
        } catch {
          // Fallback to stored mode
          compressedData = file.data;
          compressionMethod = 0;
        }
      }

      const compressedSize = compressedData.length;

      // Local File Header (30 bytes + path length)
      const localHeader = new Uint8Array(30 + pathBytes.length);
      const view = new DataView(localHeader.buffer);
      view.setUint32(0, 0x04034b50, true);          // Signature
      view.setUint16(4, 20, true);                  // Version needed (2.0)
      view.setUint16(6, 0x0800, true);              // UTF-8 flag (Bit 11)
      view.setUint16(8, compressionMethod, true);   // Compression method
      view.setUint16(10, 0, true);                 // Mod time
      view.setUint16(12, 0, true);                 // Mod date
      view.setUint32(14, crc, true);                // CRC-32
      view.setUint32(18, compressedSize, true);    // Compressed size
      view.setUint32(22, uncompressedSize, true);  // Uncompressed size
      view.setUint16(26, pathBytes.length, true);  // Filename length
      view.setUint16(28, 0, true);                 // Extra field length
      localHeader.set(pathBytes, 30);

      fileEntries.push({
        pathBytes,
        localHeader,
        compressedData,
        crc,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        offset
      });

      offset += localHeader.length + compressedData.length;
    }

    // Central Directory
    const centralEntries = [];
    let centralDirSize = 0;

    for (const entry of fileEntries) {
      const cdHeader = new Uint8Array(46 + entry.pathBytes.length);
      const view = new DataView(cdHeader.buffer);
      view.setUint32(0, 0x02014b50, true);          // CD signature
      view.setUint16(4, 20, true);                  // Version made by
      view.setUint16(6, 20, true);                  // Version needed
      view.setUint16(8, 0x0800, true);              // UTF-8 flag
      view.setUint16(10, entry.compressionMethod, true);
      view.setUint16(12, 0, true);
      view.setUint16(14, 0, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.compressedSize, true);
      view.setUint32(24, entry.uncompressedSize, true);
      view.setUint16(28, entry.pathBytes.length, true);
      view.setUint16(30, 0, true);                 // Extra field length
      view.setUint16(32, 0, true);                 // Comment length
      view.setUint16(34, 0, true);                 // Disk start
      view.setUint16(36, 0, true);                 // Internal file attributes
      view.setUint32(38, 0, true);                 // External file attributes
      view.setUint32(42, entry.offset, true);      // Local header offset
      cdHeader.set(entry.pathBytes, 46);

      centralEntries.push(cdHeader);
      centralDirSize += cdHeader.length;
    }

    // End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);        // EOCD signature
    eocdView.setUint16(4, 0, true);                 // Disk number
    eocdView.setUint16(6, 0, true);                 // CD start disk
    eocdView.setUint16(8, fileEntries.length, true); // Total records on this disk
    eocdView.setUint16(10, fileEntries.length, true); // Total records
    eocdView.setUint32(12, centralDirSize, true);    // CD size
    eocdView.setUint32(16, offset, true);            // CD offset
    eocdView.setUint16(20, 0, true);                 // Comment length

    // Assemble final buffer
    const totalZipSize = offset + centralDirSize + 22;
    const zipBuf = new Uint8Array(totalZipSize);
    let curPos = 0;

    for (const entry of fileEntries) {
      zipBuf.set(entry.localHeader, curPos);
      curPos += entry.localHeader.length;
      zipBuf.set(entry.compressedData, curPos);
      curPos += entry.compressedData.length;
    }

    for (const cd of centralEntries) {
      zipBuf.set(cd, curPos);
      curPos += cd.length;
    }

    zipBuf.set(eocd, curPos);
    return zipBuf;
  }

  /**
   * Generate ZIP archive as Blob
   */
  async generateBlob(useCompression = true) {
    const uint8 = await this.generateUint8Array(useCompression);
    return new Blob([uint8], { type: 'application/zip' });
  }
}
