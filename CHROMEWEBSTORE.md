# Chrome Web Store Listing — ConScan

> Last Updated: 2026-10-08

## Store Listing

**Extension Name** [REQUIRED]
ConScan - Confluence Attachment Scanner

**Short Description** [REQUIRED]
Scan and list all attachments across your accessible Confluence spaces by uploader, date, page, space, and size with CSV/JSON export.

**Detailed Description** [REQUIRED]
ConScan helps you discover, audit, and organize files and attachments stored across your Confluence workspace.

If you collaborate on Confluence, attachments like diagrams, spreadsheets, presentation decks, PDFs, and data files often get scattered across dozens of spaces and hundreds of pages. ConScan brings complete visibility to all files you have permission to access.

Key features:
- Automatically detects your active Confluence session (no passwords or manual token setup required).
- Scans all spaces you have permission to access or allows selecting specific spaces to target.
- Lists all attachments with detailed metadata: file name, file type, container space, page title, uploader name/avatar, upload timestamp, and file size.
- Real-time search and multi-criteria filtering: filter by uploader, space, page, date range, or file categories (Images, PDFs, Word/Docs, Excel/Sheets, Presentations, Archives, Code).
- Interactive sorting by upload date, file size, name, or author.
- One-click file downloading, direct Confluence page navigation, and link copying.
- Export clean datasets to CSV (fully compatible with Microsoft Excel and UTF-8 characters) or JSON format.

How to use:
1. Open your Confluence tab in Chrome where you are already signed in.
2. Click the ConScan extension icon in your toolbar and select "Mở ConScan Dashboard".
3. Choose your scan scope (all accessible spaces or select specific ones).
4. Click "Bắt đầu Quét" (Start Scan). ConScan will scan and populate the interactive data table in real time.
5. Filter, search, and export your findings as needed.

Privacy & Security:
ConScan operates entirely inside your local browser. All Confluence requests run locally using your existing session permissions, and no files, data, or credentials ever leave your computer.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Scans and catalogues attachments across accessible Confluence spaces by author, timestamp, page, and space.

**Primary Language** [REQUIRED]
English (also supports Vietnamese interface)

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 | ⬜ Pending capture | |
| Screenshot 2 [RECOMMENDED] | 1280×800 | ⬜ Pending capture | |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Saves local user preferences such as custom throttle delay and last selected spaces. |
| `tabs` | permissions | Detects open Confluence tabs to establish a connection with the user's active session. |
| `scripting` | permissions | Connects with the active Confluence tab to query spaces and attachment metadata using session permissions. |
| `*://*/*` | host_permissions | Allows connecting to Confluence Cloud domains as well as internal on-premise Confluence Server / Data Center instances hosted on custom corporate domains. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

All operations and file queries occur exclusively in the user's local browser instance.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-10-08 | Initial release with full space scan, CQL engine, filter/search table, and CSV/JSON export | Draft |
