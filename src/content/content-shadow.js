// src/content/content.js - Shadow DOM Version

let pcloudUploadWidget = null;
let pcloudUploadShadow = null;
let isDraggingImage = false;
let widgetHideTimeout = null;
let uploads = [];

function createUploadWidget() {
    // Create container
    pcloudUploadWidget = document.createElement('div');
    pcloudUploadWidget.id = 'pcloud-upload-widget';

    // Attach Shadow DOM
    pcloudUploadShadow = pcloudUploadWidget.attachShadow({ mode: 'open' });

    // Inject styles and HTML
    pcloudUploadShadow.innerHTML = `
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
            }
            
            :host(.visible) {
                transform: scale(1);
                opacity: 1;
                pointer-events: auto;
            }
            
            .upload-container {
                width: 100%;
                height: 100%;
                background-color: #f4f7f6;
                border-radius: 10px;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
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
                fill: #666;
            }
            
            h3 {
                color: #00579D;
                font-size: 1.2em;
                margin-top: 0;
                margin-bottom: 10px;
                text-align: center;
            }
            
            #drop-zone {
                border: 2px dashed #cccccc;
                border-radius: 8px;
                padding: 15px;
                text-align: center;
                cursor: pointer;
                background-color: #fff;
                position: relative;
                min-height: 100px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }
            
            #drop-zone.drag-over {
                border-color: #00579D;
                background-color: #eaf4ff;
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
                fill: #00579D;
                opacity: 0.6;
            }
            
            #drop-zone-text {
                color: #888;
                font-size: 0.9em;
            }
            
            #select-file-link {
                font-size: 0.9em;
                color: #00579D;
                text-decoration: underline;
                cursor: pointer;
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
                border-bottom: 1px solid #eee;
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
                color: #333;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 200px;
            }
            
            .upload-item .item-progress-bar-container {
                width: 100%;
                height: 5px;
                background-color: #e0e0e0;
                border-radius: 5px;
                margin-top: 4px;
                overflow: hidden;
            }
            
            .upload-item .item-progress-bar {
                width: 0%;
                height: 100%;
                background-color: #28a745;
                border-radius: 5px;
                transition: width 0.3s ease-in-out;
            }
            
            .upload-item .item-progress-bar.in-progress {
                background-color: #00579D;
                background-image: linear-gradient(45deg, rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 75%, transparent);
                background-size: 1rem 1rem;
                animation: progress-bar-stripes 1s linear infinite;
            }
            
            .upload-item .item-progress-bar.error {
                background-color: #dc3545;
                width: 100%;
            }
            
            .upload-item-status {
                font-size: 12px;
                color: #888;
                width: 80px;
                text-align: right;
                flex-shrink: 0;
            }
            
            .upload-item-status.status-done {
                color: #28a745;
            }
            
            .upload-item-status.status-error {
                color: #dc3545;
            }
            
            @keyframes progress-bar-stripes {
                from { background-position: 1rem 0; }
                to { background-position: 0 0; }
            }
            
            .hidden {
                display: none !important;
            }
        </style>
        
        <div class="upload-container">
            <button class="close-btn" id="close-button" title="Close">
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d= "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
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

    document.body.appendChild(pcloudUploadWidget);

    // Initialize widget functionality
    initializeWidgetEvents();
}

function initializeWidgetEvents() {
    const shadow = pcloudUploadShadow;

    // Get elements
    const dropZone = shadow.getElementById('drop-zone');
    const uploadList = shadow.getElementById('upload-list');
    const dropZoneText = shadow.getElementById('drop-zone-text');
    const selectFileLink = shadow.getElementById('select-file-link');
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
    window.renderUploads = function () {
        const shadow = pcloudUploadShadow;
        const uploadList = shadow.getElementById('upload-list');
        const dropZoneText = shadow.getElementById('drop-zone-text');
        const selectFileLink = shadow.getElementById('select-file-link');
        const dropZoneContent = shadow.getElementById('drop-zone-content');

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
    };
}

// Listen for upload state updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'uploadStateUpdate') {
        uploads = message.payload;
        if (window.renderUploads) {
            window.renderUploads();
        }
    }
});

// Request initial state
chrome.runtime.sendMessage({ type: 'requestInitialState' });

// --- Main Drag and Drop Logic ---

let currentDraggedImageUrl = null;

document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') {
        isDraggingImage = true;
        currentDraggedImageUrl = e.target.src;
        console.log('[pCloud] Drag started, image URL:', currentDraggedImageUrl);

        // Show widget
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

// --- Keyboard shortcut handler ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleUploadWidget') {
        if (pcloudUploadWidget) {
            pcloudUploadWidget.classList.toggle('visible');
            if (pcloudUploadWidget.classList.contains('visible')) {
                if (widgetHideTimeout) clearTimeout(widgetHideTimeout);
            }
        }
        sendResponse({ status: "ok" });
        return true;
    }

    if (request.action === "showToast") {
        showToast(request.message, request.toastType, request.duration);
        sendResponse({ status: "ok" });
        return true;
    }

    // ... other message handlers remain the same
});

// Initialize
createUploadWidget();

// ... rest of content.js code (selection HTML, toast notifications, etc.)
