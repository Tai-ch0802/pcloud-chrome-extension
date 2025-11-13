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
    // Request the current upload state from the service worker
    chrome.runtime.sendMessage({ type: 'requestInitialState' });
});