# 004 - Context Menu Text Selection Upload to pCloud

## Feature Description

This feature allows users to select text on any webpage, right-click, and upload the selected content to their pCloud account as a Markdown file. The selected text's original HTML formatting (such as paragraphs, headings, lists, links, bold/italic text) will be preserved as much as possible by converting it into pCloud-compatible Markdown format.

## Motivation

To provide a convenient way for users to save important text snippets, articles, or notes directly from web pages to their pCloud storage, maintaining readability and structure. This enhances the extension's utility for research, note-taking, and content curation.

## User Experience

1.  The user navigates to any webpage containing text.
2.  The user selects a portion of text using their mouse.
3.  The user right-clicks on the selected text.
4.  A new context menu item, "Upload selection to pCloud" (localized), appears.
5.  The user clicks on "Upload selection to pCloud".
6.  A notification (e.g., "Uploading to pCloud...", "Upload successful!", "Upload failed.") appears to inform the user about the status of the operation.
7.  Upon successful upload, a new Markdown file (`.md`) is created in the user's pCloud root directory (or a configurable directory in the future) containing the formatted text.

## Technical Details

### 1. Context Menu Registration

*   A new context menu item will be registered in `src/background/service-worker.js` using `chrome.contextMenus.create()`.
*   The item will be active only when text is selected (`contexts: ["selection"]`).
*   The title of the menu item will be internationalized using `chrome.i18n.getMessage("contextMenuItemUploadSelection")`.

### 2. Selected HTML Retrieval

*   When the context menu item is clicked, `service-worker.js` will send a message to the active tab's content script (`src/content/content.js`).
*   `src/content/content.js` will listen for this message. Upon receiving it, it will retrieve the currently selected text's HTML content. This involves using `window.getSelection().getRangeAt(0).cloneContents()` to capture the full HTML structure, not just plain text.
*   The content script will then send this HTML string back to the `service-worker.js`.

### 3. HTML to Markdown Conversion

*   A third-party JavaScript library, `Turndown` (`turndown.js`), will be used for reliable HTML to Markdown conversion. This library will be added to `src/assets/vendor/`.
*   The `service-worker.js` will utilize this library to convert the received HTML string into a Markdown formatted string.

### 4. pCloud API Integration for Upload

*   The converted Markdown string will be uploaded to the user's pCloud account using the existing pCloud API client (`src/core/pcloud-api.js`).
*   The file will be named based on the first few words of the selection and a timestamp (e.g., `selection-first-words-YYYYMMDD-HHMMSS.md`).
*   Initially, files will be uploaded to the root directory (`folderid: 0`). Future enhancements may include a user-configurable upload directory via the options page.

### 5. Notifications

*   `chrome.notifications` API will be used to provide feedback to the user regarding the upload status (in-progress, success, failure).
*   Notification messages will be internationalized.

### 6. Internationalization (i18n)

*   New string keys will be added to `_locales/en/messages.json` and `_locales/zh_TW/messages.json` for:
    *   The context menu item title.
    *   Notification titles and messages for upload status.

## Files Affected

*   `doc/feat-spec/004-context-menu-text-selection-upload.md` (new file)
*   `src/assets/vendor/turndown.js` (new file, external library)
*   `manifest.json`
*   `_locales/en/messages.json`
*   `_locales/zh_TW/messages.json`
*   `src/background/service-worker.js`
*   `src/content/content.js`
*   `src/features/free/contextMenuTextUploader.js` (new file for modularity)