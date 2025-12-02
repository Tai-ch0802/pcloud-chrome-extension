// src/content/content.js - Complete Shadow DOM Version

let pcloudUploadWidget = null;
let pcloudUploadShadow = null;
let uploads = [];
let isDraggingImage = false;
let widgetHideTimeout = null;

function createUploadWidget() {
    // Create container with inline style to prevent flash before Shadow DOM styles load
    pcloudUploadWidget = document.createElement('div');
    pcloudUploadWidget.id = 'pcloud-upload-widget';
    // Critical: Hide completely until explicitly shown
    pcloudUploadWidget.style.cssText = 'display: none !important;';

    // Attach Shadow DOM
    pcloudUploadShadow = pcloudUploadWidget.attachShadow({ mode: 'open' });

    // Function to generate styles using CSS variables from the theme
    function generateStyles() {
        return `
        <style>
            :host {
                all: initial;
                position: fixed;
                bottom: 100px;
                right: 20px;
                width: 350px;
                height: 300px;
                z-index: 99999999;
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                transition: 
                    transform 400ms cubic-bezier(0.2, 0, 0, 1),
                    opacity 400ms cubic-bezier(0.2, 0, 0, 1);
                transform: scale(0.9);
                opacity: 0;
                pointer-events: none;
                /* Initially completely hidden to prevent flash */
                display: none;
            }
            
            :host(.visible) {
                display: block;
                transform: scale(1);
                opacity: 1;
                pointer-events: auto;
            }
            
            .upload-container {
                width: 100%;
                height: 100%;
                background-color: var(--mdc-theme-background, #f1f3f4);
                border-radius: var(--card-border-radius, 8px);
                box-shadow: var(--card-shadow, 0 1px 2px 0 rgba(60, 64, 67, .3), 0 2px 6px 2px rgba(60, 64, 67, .15));
                padding: 10px;
                box-sizing: border-box;
                position: relative;
                overflow: hidden;
            }
            
            .close-btn {
                position: absolute;
                top: 4px;
                right: 4px;
                width: 24px;
                height: 24px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 200ms cubic-bezier(0.2, 0, 0, 1);
                padding: 0;
                z-index: 10;
            }
            
            .close-btn:hover {
                background-color: rgba(0, 0, 0, 0.08);
            }
            
            .close-btn:active {
                background-color: rgba(0, 0, 0, 0.12);
            }
            
            .close-btn svg {
                width: 16px;
                height: 16px;
                fill: var(--mdc-theme-on-surface, #202124);
            }
            
            h3 {
                color: var(--mdc-theme-primary, #1a73e8);
                font-size: 1.2em;
                margin-top: 0;
                margin-bottom: 10px;
                text-align: center;
            }
            
            #drop-zone {
                border: 2px dashed var(--border-color, #dadce0);
                border-radius: 8px;
                padding: 15px;
                text-align: center;
                cursor: pointer;
                background-color: var(--mdc-theme-surface, #ffffff);
                position: relative;
                min-height: 100px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }
            
            #drop-zone.drag-over {
                border-color: var(--mdc-theme-primary, #1a73e8);
                background-color: var(--progress-bar-bg-color, #d1e2fc);
            }
            
            #drop-zone-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }
            
            .upload-icon {
                width: 48px;
                height: 48px;
                fill: var(--mdc-theme-primary, #1a73e8);
                opacity: 0.6;
            }
            
            #drop-zone-text {
                color: var(--secondary-text-color, #5f6368);
                font-size: 0.9em;
            }
            
            #select-file-link {
                font-size: 0.9em;
                color: var(--mdc-theme-primary, #1a73e8);
                text-decoration: underline;
                cursor: pointer;
            }
            
            #select-file-link:hover {
                color: var(--accent-color-hover, #1b66c9);
            }
            
            #upload-list {
                width: 100%;
                max-height: 150px;
                overflow-y: auto;
                margin-bottom: 8px;
            }
            
            .upload-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 4px;
                border-bottom: 1px solid var(--border-color, #dadce0);
            }
            
            .upload-item:last-child {
                border-bottom: none;
            }
            
            .upload-item-info {
                flex-grow: 1;
                text-align: left;
                margin-right: 8px;
            }
            
            .upload-item-info .file-name {
                font-size: 13px;
                color: var(--mdc-theme-on-surface, #202124);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 200px;
            }
            
            .upload-item .item-progress-bar-container {
                width: 100%;
                height: 5px;
                background-color: var(--progress-bar-bg-color, #d1e2fc);
                border-radius: 5px;
                margin-top: 4px;
                overflow: hidden;
            }
            
            .upload-item .item-progress-bar {
                width: 0%;
                height: 100%;
                background-color: var(--success-color, #1e8e3e);
                border-radius: 5px;
                transition: width 0.3s ease-in-out;
            }
            
            .upload-item .item-progress-bar.in-progress {
                background-color: var(--mdc-theme-primary, #1a73e8);
                background-image: linear-gradient(45deg, rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 75%, transparent);
                background-size: 1rem 1rem;
                animation: progress-bar-stripes 1s linear infinite;
            }
            
            .upload-item .item-progress-bar.error {
                background-color: var(--mdc-theme-error, #d93025);
                width: 100%;
            }
            
            .upload-item-status {
                font-size: 12px;
                color: var(--secondary-text-color, #5f6368);
                width: 80px;
                text-align: right;
                flex-shrink: 0;
            }
            
            .upload-item-status.status-done {
                color: var(--success-color, #1e8e3e);
            }
            
            .upload-item-status.status-error {
                color: var(--mdc-theme-error, #d93025);
            }
            
            @keyframes progress-bar-stripes {
                from { background-position: 1rem 0; }
                to { background-position: 0 0; }
            }
            
            .hidden {
                display: none !important;
            }
        </style>
        `;
    }

    // Function to inject theme CSS variables into Shadow DOM
    async function injectThemeVariables() {
        const { selected_theme = 'theme-googlestyle' } = await chrome.storage.sync.get('selected_theme');

        // Get computed styles from the document root to access CSS variables
        const rootStyles = getComputedStyle(document.documentElement);

        // Create a style element with the theme variables
        const themeVars = `
            :host {
                --mdc-theme-primary: ${rootStyles.getPropertyValue('--mdc-theme-primary') || '#1a73e8'};
                --mdc-theme-on-primary: ${rootStyles.getPropertyValue('--mdc-theme-on-primary') || '#ffffff'};
                --mdc-theme-secondary: ${rootStyles.getPropertyValue('--mdc-theme-secondary') || '#1a73e8'};
                --mdc-theme-on-secondary: ${rootStyles.getPropertyValue('--mdc-theme-on-secondary') || '#ffffff'};
                --mdc-theme-surface: ${rootStyles.getPropertyValue('--mdc-theme-surface') || '#ffffff'};
                --mdc-theme-on-surface: ${rootStyles.getPropertyValue('--mdc-theme-on-surface') || '#202124'};
                --mdc-theme-background: ${rootStyles.getPropertyValue('--mdc-theme-background') || '#f1f3f4'};
                --mdc-theme-on-background: ${rootStyles.getPropertyValue('--mdc-theme-on-background') || '#202124'};
                --mdc-theme-error: ${rootStyles.getPropertyValue('--mdc-theme-error') || '#d93025'};
                --mdc-theme-on-error: ${rootStyles.getPropertyValue('--mdc-theme-on-error') || '#ffffff'};
                --secondary-text-color: ${rootStyles.getPropertyValue('--secondary-text-color') || '#5f6368'};
                --border-color: ${rootStyles.getPropertyValue('--border-color') || '#dadce0'};
                --success-color: ${rootStyles.getPropertyValue('--success-color') || '#1e8e3e'};
                --accent-color-hover: ${rootStyles.getPropertyValue('--accent-color-hover') || '#1b66c9'};
                --card-bg-color: ${rootStyles.getPropertyValue('--card-bg-color') || '#ffffff'};
                --card-shadow: ${rootStyles.getPropertyValue('--card-shadow') || '0 1px 2px 0 rgba(60, 64, 67, .3), 0 2px 6px 2px rgba(60, 64, 67, .15)'};
                --card-border-radius: ${rootStyles.getPropertyValue('--card-border-radius') || '8px'};
                --progress-bar-bg-color: ${rootStyles.getPropertyValue('--progress-bar-bg-color') || '#d1e2fc'};
            }
        `;

        return themeVars;
    }

    // Function to update widget theme
    async function updateWidgetTheme() {
        const { selected_theme = 'theme-googlestyle' } = await chrome.storage.sync.get('selected_theme');

        // Apply theme class to document if not already applied
        document.documentElement.classList.remove('theme-googlestyle', 'theme-geek');
        document.documentElement.classList.add(selected_theme);

        // Wait a tick for CSS variables to be applied
        await new Promise(resolve => setTimeout(resolve, 0));

        const themeVars = await injectThemeVariables();
        const styles = generateStyles();

        // Re-inject the entire shadow DOM with new styles
        pcloudUploadShadow.innerHTML = `
        <style>${themeVars}</style>
        ${styles}
        <div class="upload-container">
            <button class="close-btn" id="close-button" title="Close">
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
            <h3>pCloud Upload</h3>
            <div id="drop-zone">
                <div id="upload-list"></div>
                <div id="drop-zone-content">
                    <svg class="upload-icon" viewBox="0 0 24 24">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                    </svg>
                    <div id="drop-zone-text"></div>
                    <a href="#" id="select-file-link"></a>
                </div>
            </div>
            <input type="file" id="file-input" multiple style="display: none;">
        </div>
        `;

        // Re-initialize event listeners
        initializeWidgetEvents();

        // Re-render uploads if any
        if (window.pcloudRenderUploads) {
            window.pcloudRenderUploads();
        }
    }

    // Initial theme setup
    updateWidgetTheme();

    // Listen for theme changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.selected_theme) {
            console.log('[pCloud] Theme changed, updating widget');
            updateWidgetTheme();
        }
    });

    document.body.appendChild(pcloudUploadWidget);
}

function initializeWidgetEvents() {
    const shadow = pcloudUploadShadow;

    // Get elements
    const dropZone = shadow.getElementById('drop-zone');
    const uploadList = shadow.getElementById('upload-list');
    const dropZoneText = shadow.getElementById('drop-zone-text');
    const selectFileLink = shadow.getElementById('select-file-link');
    const dropZoneContent = shadow.getElementById('drop-zone-content');
    const fileInput = shadow.getElementById('file-input');
    const closeBtn = shadow.getElementById('close-button');

    // Initialize i18n
    dropZoneText.textContent = chrome.i18n.getMessage('upload_drag_and_drop_prompt') || 'Drag & drop files here';
    selectFileLink.textContent = chrome.i18n.getMessage('upload_select_file_link') || 'Or select files';

    // Close button
    closeBtn.addEventListener('click', () => {
        pcloudUploadWidget.classList.remove('visible');
        if (widgetHideTimeout) clearTimeout(widgetHideTimeout);
        console.log('[pCloud] Upload widget closed via close button');
    });

    // File selection
    selectFileLink.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = () => {
                    chrome.runtime.sendMessage({
                        type: 'startUploadFromFile',
                        payload: {
                            name: file.name,
                            type: file.type,
                            dataUrl: reader.result
                        }
                    });
                };
                reader.readAsDataURL(file);
            });
            fileInput.value = ''; // Reset
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    dropZone.addEventListener('dragleave', (e) => {
        if (e.target === dropZone) {
            dropZone.classList.remove('drag-over');
        }
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = () => {
                    chrome.runtime.sendMessage({
                        type: 'startUploadFromFile',
                        payload: {
                            name: file.name,
                            type: file.type,
                            dataUrl: reader.result
                        }
                    });
                };
                reader.readAsDataURL(file);
            });
        }
    });

    // Mouse enter/leave for auto-hide
    pcloudUploadWidget.addEventListener('mouseenter', () => {
        if (widgetHideTimeout) {
            clearTimeout(widgetHideTimeout);
            console.log('[pCloud] Auto-hide cancelled (mouse entered widget)');
        }
    });

    pcloudUploadWidget.addEventListener('mouseleave', () => {
        widgetHideTimeout = setTimeout(() => {
            pcloudUploadWidget.classList.remove('visible');
            console.log('[pCloud] Auto-hiding upload widget after mouseleave');
        }, 5000);
    });

    // Render function
    function renderUploads() {
        uploadList.innerHTML = '';

        if (uploads.length > 0) {
            dropZoneContent.classList.add('hidden');
        } else {
            dropZoneContent.classList.remove('hidden');
        }

        uploads.forEach(upload => {
            const item = document.createElement('div');
            item.className = 'upload-item';

            let statusHTML = '';
            let progressBarWidth = upload.progress;
            let progressBarClass = 'item-progress-bar';

            if (upload.status === 'fetching' || upload.status === 'starting') {
                statusHTML = `<div class="upload-item-status">Starting...</div>`;
            } else if (upload.status === 'uploading') {
                statusHTML = `<div class="upload-item-status">Uploading...</div>`;
                progressBarWidth = 100;
                progressBarClass += ' in-progress';
            } else if (upload.status === 'done') {
                statusHTML = `<div class="upload-item-status status-done">Done</div>`;
            } else if (upload.status === 'clearing') {
                statusHTML = `<div class="upload-item-status">Removing in ${upload.countdown}s...</div>`;
            } else if (upload.status === 'error') {
                statusHTML = `<div class="upload-item-status status-error">Error</div>`;
                progressBarClass += ' error';
            }

            item.innerHTML = `
                <div class="upload-item-info">
                    <div class="file-name" title="${upload.fileName}">${upload.fileName}</div>
                    <div class="item-progress-bar-container">
                        <div class="${progressBarClass}" style="width: ${progressBarWidth}%"></div>
                    </div>
                </div>
                ${statusHTML}
            `;
            uploadList.appendChild(item);
        });
    }

    // Expose render function
    window.pcloudRenderUploads = renderUploads;
}

// --- Main Drag and Drop Logic ---

let currentDraggedImageUrl = null;

document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') {
        isDraggingImage = true;
        currentDraggedImageUrl = e.target.src;
        console.log('[pCloud] Drag started, image URL:', currentDraggedImageUrl);

        // Show widget - remove inline style and add visible class
        pcloudUploadWidget.style.cssText = '';
        pcloudUploadWidget.classList.add('visible');
        if (widgetHideTimeout) clearTimeout(widgetHideTimeout);
    }
});

document.addEventListener('dragend', (e) => {
    if (isDraggingImage) {
        console.log('[pCloud] Drag ended at', e.clientX, e.clientY);

        // Check if drag ended over the widget
        const widgetRect = pcloudUploadWidget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        const isOverWidget = (
            x >= widgetRect.left &&
            x <= widgetRect.right &&
            y >= widgetRect.top &&
            y <= widgetRect.bottom &&
            pcloudUploadWidget.classList.contains('visible')
        );

        console.log('[pCloud] Drag ended over widget?', isOverWidget);

        if (isOverWidget && currentDraggedImageUrl) {
            console.log('[pCloud] Triggering upload on dragend:', currentDraggedImageUrl);
            chrome.runtime.sendMessage({
                type: 'startUploadFromUrl',
                payload: {
                    imageUrl: currentDraggedImageUrl,
                    pageTitle: document.title
                }
            });
        }

        // Auto-hide after 5s
        if (widgetHideTimeout) clearTimeout(widgetHideTimeout);
        widgetHideTimeout = setTimeout(() => {
            if (!pcloudUploadWidget.matches(':hover')) {
                pcloudUploadWidget.classList.remove('visible');
                console.log('[pCloud] Auto-hiding upload widget after 5s');
            }
        }, 5000);

        isDraggingImage = false;
        setTimeout(() => {
            currentDraggedImageUrl = null;
        }, 500);
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

// --- Initialize ---
createUploadWidget();

// Request initial state
chrome.runtime.sendMessage({ type: 'requestInitialState' });

// --- Function to get selected HTML with absolute URLs ---
function getSelectionHtml() {
    let html = "";
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();

        // Resolve relative URLs
        const images = fragment.querySelectorAll('img');
        images.forEach(img => {
            img.src = img.src; // Accessing .src property returns absolute URL
        });
        const links = fragment.querySelectorAll('a');
        links.forEach(a => {
            a.href = a.href; // Accessing .href property returns absolute URL
        });

        const div = document.createElement("div");
        div.appendChild(fragment);
        html = div.innerHTML;
    }
    return html;
}

//--- Helper to embed images into HTML for PDF/DOC generation ---
async function embedImagesInHtml(html, images) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const imgTags = doc.querySelectorAll('img');

    for (let img of imgTags) {
        const src = img.getAttribute('src');
        const match = images.find(i => i.originalUrl === src);
        if (match && match.base64Url) {
            img.src = match.base64Url;
        }
    }
    return doc.body.innerHTML;
}

// --- Listener for messages from the background script ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'uploadStateUpdate') {
        uploads = request.payload;
        if (window.pcloudRenderUploads) {
            window.pcloudRenderUploads();
        }
        return;
    }

    if (request.action === "getMarkdownFromSelection") {
        const selectedHtml = getSelectionHtml();
        if (selectedHtml && typeof TurndownService === 'function') {
            const turndownService = new TurndownService();
            const markdown = turndownService.turndown(selectedHtml);
            sendResponse({ markdown: markdown });
        } else {
            sendResponse({ markdown: "" });
        }
        return true;
    }

    if (request.action === "getSelectionData") {
        const selectedHtml = getSelectionHtml();
        let markdown = "";
        if (selectedHtml && typeof TurndownService === 'function') {
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced',
                emDelimiter: '*'
            });

            // Configure Turndown to keep images
            turndownService.addRule('keepImages', {
                filter: 'img',
                replacement: function (content, node) {
                    const alt = node.alt || '';
                    const src = node.src || '';
                    return src ? `![${alt}](${src})` : '';
                }
            });

            // Handle linked images: <a href="..."><img src="..." /></a>
            // Convert to just the image, not the link
            turndownService.addRule('unwrapLinkedImages', {
                filter: function (node, options) {
                    return (
                        node.nodeName === 'A' &&
                        node.querySelector('img') &&
                        node.children.length === 1 &&
                        node.children[0].nodeName === 'IMG'
                    );
                },
                replacement: function (content, node) {
                    // Extract just the image
                    const img = node.querySelector('img');
                    const alt = img.alt || '';
                    const src = img.src || '';
                    return src ? `![${alt}](${src})` : '';
                }
            });

            // Handle nested links (links within links) - keep only the outermost link
            turndownService.addRule('flattenNestedLinks', {
                filter: function (node, options) {
                    return (
                        node.nodeName === 'A' &&
                        node.querySelector('a')
                    );
                },
                replacement: function (content, node) {
                    // Get the first link's href
                    const href = node.href || '';
                    // Strip out any nested link markdown and just use plain text
                    const textContent = node.textContent || '';
                    return href ? `[${textContent}](${href})` : textContent;
                }
            });

            // Handle links with complex nested content
            turndownService.addRule('cleanLinks', {
                filter: 'a',
                replacement: function (content, node) {
                    const href = node.href || '';
                    if (!href) return content;

                    // Clean up content: remove extra whitespace and newlines
                    const cleanContent = content
                        .replace(/\n+/g, ' ')  // Replace newlines with spaces
                        .replace(/\s+/g, ' ')   // Collapse multiple spaces
                        .trim();

                    // If content is empty or just whitespace, use href as title
                    const title = cleanContent || href;

                    return `[${title}](${href})`;
                }
            });

            markdown = turndownService.turndown(selectedHtml);

            // Post-process: Clean up any remaining malformed links
            // Pattern: ][  (closing bracket followed by opening bracket with space)
            markdown = markdown.replace(/\]\s*\[/g, '] [');

            // Pattern: Multiple consecutive links with no space
            markdown = markdown.replace(/\)\[/g, ')\n\n[');

            // Clean up excessive whitespace
            markdown = markdown.replace(/\n{3,}/g, '\n\n');
        }
        sendResponse({ html: selectedHtml, markdown: markdown });
        return true;
    }

    if (request.action === "generateDoc") {
        (async () => {
            try {
                const { dataKey } = request;
                const storageData = await chrome.storage.local.get(dataKey);
                const { html, images } = storageData[dataKey];

                const embeddedHtml = await embedImagesInHtml(html, images);
                const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${embeddedHtml}</body></html>`;

                let converted = null;
                if (typeof htmlDocx !== 'undefined') {
                    converted = htmlDocx.asBlob(fullHtml);
                } else if (window.htmlDocx) {
                    converted = window.htmlDocx.asBlob(fullHtml);
                } else {
                    throw new Error("html-docx library not found");
                }

                const reader = new FileReader();
                reader.onloadend = () => sendResponse({ dataUrl: reader.result });
                reader.readAsDataURL(converted);
            } catch (e) {
                console.error("DOC Generation Error", e);
                sendResponse({ error: e.message });
            }
        })();
        return true;
    }

    if (request.action === "ping") {
        sendResponse({ status: "pong" });
        return true;
    }

    if (request.action === "showToast") {
        showToast(request.message, request.toastType, request.duration);
        sendResponse({ status: "ok" });
        return true;
    }

    if (request.action === "toggleUploadWidget") {
        if (pcloudUploadWidget) {
            const isVisible = pcloudUploadWidget.classList.contains('visible');
            if (isVisible) {
                // Hide
                pcloudUploadWidget.classList.remove('visible');
            } else {
                // Show - remove inline style
                pcloudUploadWidget.style.cssText = '';
                pcloudUploadWidget.classList.add('visible');
                if (widgetHideTimeout) clearTimeout(widgetHideTimeout);
            }
        }
        sendResponse({ status: "ok" });
        return true;
    }
});

// --- Toast Notification Logic ---
let pcloudToast = null;
let toastTimeout = null;

function createToast() {
    if (pcloudToast) return;

    pcloudToast = document.createElement('div');
    pcloudToast.className = 'pcloud-toast';
    pcloudToast.innerHTML = `
        <div class="pcloud-toast-icon"></div>
        <div class="pcloud-toast-message"></div>
        <div class="pcloud-toast-action"></div>
    `;
    document.body.appendChild(pcloudToast);

    // Add click listener to the action button
    const actionBtn = pcloudToast.querySelector('.pcloud-toast-action');
    actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Toggle the upload widget visibility
        if (pcloudUploadWidget) {
            // Show widget - remove inline style and add visible class
            pcloudUploadWidget.style.cssText = '';
            pcloudUploadWidget.classList.add('visible');
            // Clear any hide timeout
            if (widgetHideTimeout) clearTimeout(widgetHideTimeout);
        }
    });
}

function showToast(message, type = 'info', duration = 3000) {
    createToast();

    const iconEl = pcloudToast.querySelector('.pcloud-toast-icon');
    const msgEl = pcloudToast.querySelector('.pcloud-toast-message');
    const actionEl = pcloudToast.querySelector('.pcloud-toast-action');

    msgEl.textContent = message;
    actionEl.textContent = chrome.i18n.getMessage('toast_view_button') || 'VIEW';

    // Icon logic
    if (type === 'loading') {
        iconEl.innerHTML = '<div class="pcloud-spinner"></div>';
    } else if (type === 'success') {
        iconEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    } else if (type === 'error') {
        iconEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    } else {
        iconEl.innerHTML = '';
    }

    pcloudToast.classList.add('visible');

    if (toastTimeout) clearTimeout(toastTimeout);

    if (duration > 0) {
        toastTimeout = setTimeout(() => {
            pcloudToast.classList.remove('visible');
        }, duration);
    }
}