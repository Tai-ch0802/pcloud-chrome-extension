// src/content/upload_ui.js

let uploads = []; // Local cache of the central state

// --- DOM Elements ---
const uploadList = document.getElementById('upload-list');
const dropZoneText = document.getElementById('drop-zone-text');
const selectFileLink = document.getElementById('select-file-link');

// --- Rendering Logic ---
function renderUploads() {
    uploadList.innerHTML = '';

    if (uploads.length > 0) {
        dropZoneText.classList.add('hidden');
        selectFileLink.classList.add('hidden');
    } else {
        dropZoneText.classList.remove('hidden');
        selectFileLink.classList.remove('hidden');
    }

    uploads.forEach(upload => {
        const item = document.createElement('div');
        item.className = 'upload-item';
        item.id = `upload-${upload.id}`;

        let statusHTML = '';
        let progressBarWidth = upload.progress;
        let progressBarClass = 'item-progress-bar';

        if (upload.status === 'fetching' || upload.status === 'starting') {
            statusHTML = `<div class="upload-item-status">Starting...</div>`;
        } else if (upload.status === 'uploading') {
            statusHTML = `<div class="upload-item-status">Uploading...</div>`;
            progressBarWidth = 100; // Full width for animation
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

// --- Message Listener for State Updates ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'uploadStateUpdate') {
        uploads = message.payload;
        renderUploads();
    }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize i18n for all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            element.textContent = message;
        }
    });

    // Request the current upload state from the service worker
    chrome.runtime.sendMessage({ type: 'requestInitialState' });

    // Close button handler
    const closeBtn = document.getElementById('close-button');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Notify parent to hide the iframe
            window.parent.postMessage({ type: 'pcloud-close-upload-widget' }, '*');
        });
    }

    // Store the currently dragged image URL from parent page
    let currentDraggedImageUrl = null;

    // --- Listen for drag start notification from parent (main page) ---
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'pcloud-drag-started') {
            currentDraggedImageUrl = event.data.imageUrl;
            console.log('[pCloud iframe] Received drag notification, URL:', currentDraggedImageUrl);
        }
    });

    // --- Drag and Drop Handling ---
    // This handles both desktop files AND images from same page (via postMessage)
    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        document.body.classList.add('drag-over');
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy'; // Explicitly show copy cursor (green +)
        document.body.classList.add('drag-over');
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only remove if leaving the document (not entering a child)
        if (e.relatedTarget === null || e.target === document.documentElement) {
            document.body.classList.remove('drag-over');
        }
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        document.body.classList.remove('drag-over');

        console.log('[pCloud iframe] Drop event triggered');
        console.log('[pCloud iframe] Current dragged URL:', currentDraggedImageUrl);

        // Priority 1: Use image URL from parent page (for same-page image drops)
        if (currentDraggedImageUrl) {
            console.log('[pCloud iframe] Triggering upload from parent drag:', currentDraggedImageUrl);
            chrome.runtime.sendMessage({
                type: 'startUploadFromUrl',
                payload: {
                    imageUrl: currentDraggedImageUrl,
                    pageTitle: window.parent.document.title || 'Dropped Image'
                }
            });
            currentDraggedImageUrl = null; // Clear after use
            return;
        }

        // Priority 2: Handle Files (from desktop/file manager)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            console.log('[pCloud iframe] Handling desktop files:', e.dataTransfer.files.length);
            Array.from(e.dataTransfer.files).forEach(file => {
                // Read file and send to background
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
            return;
        }

        console.log('[pCloud iframe] No valid drop data found');
    });
});