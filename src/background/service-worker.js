// src/background/service-worker.js

import { getAuthToken } from '../core/auth.js';
import PCloudAPIClient from '../core/pcloud-api.js';

// --- Centralized Global State ---
let uploads = [];
const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';

// --- Helper to broadcast state to all UIs ---
function broadcastState() {
    const state = { type: 'uploadStateUpdate', payload: uploads };
    // Send to popup
    chrome.runtime.sendMessage(state).catch(() => {});
    // Send to all content scripts
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, state).catch(() => {});
        });
    });
}

// --- File Conversion Helper ---
async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return await res.blob();
}

// --- Unified Upload Logic ---
async function startUpload(uploadId, file) {
    const upload = uploads.find(u => u.id === uploadId);
    if (!upload) return;

    try {
        const authToken = await getAuthToken();
        if (!authToken) throw new Error('Not authenticated');
        
        const client = new PCloudAPIClient(authToken);
        const { [DEFAULT_UPLOAD_FOLDER_ID_KEY]: folderId = 0 } = await chrome.storage.sync.get(DEFAULT_UPLOAD_FOLDER_ID_KEY);

        upload.status = 'uploading';
        broadcastState();

        const result = await client.uploadFile(file, folderId);

        if (result.metadata && result.metadata.length > 0) {
            upload.progress = 100; // Set to 100 on completion
            upload.status = 'done';
            broadcastState();

            setTimeout(() => {
                upload.status = 'clearing';
                const intervalId = setInterval(() => {
                    upload.countdown--;
                    if (upload.countdown <= 0) {
                        clearInterval(intervalId);
                        uploads = uploads.filter(u => u.id !== uploadId);
                    }
                    broadcastState();
                }, 1000);
            }, 500);
        } else {
            throw new Error('Upload completed but no metadata received.');
        }
    } catch (error) {
        console.error('Upload failed:', error);
        if (upload) {
            upload.status = 'error';
            broadcastState();
        }
    }
}

// --- Main Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    if (type === 'startUploadFromUrl' && payload.imageUrl) {
        const uploadId = Date.now() + '-' + Math.random();
        const newUpload = {
            id: uploadId,
            fileName: payload.imageUrl.substring(payload.imageUrl.lastIndexOf('/') + 1).split('?')[0] || 'upload.jpg',
            progress: 0,
            status: 'fetching',
            countdown: 30,
        };
        uploads.push(newUpload);
        broadcastState();

        fetch(payload.imageUrl)
            .then(response => response.blob())
            .then(blob => new File([blob], newUpload.fileName, { type: blob.type }))
            .then(file => startUpload(uploadId, file))
            .catch(error => {
                console.error('URL fetch failed:', error);
                const upload = uploads.find(u => u.id === uploadId);
                if (upload) {
                    upload.status = 'error';
                    broadcastState();
                }
            });
        return true;
    }
    
    if (type === 'startUploadFromFile' && payload.dataUrl) {
        const uploadId = Date.now() + '-' + Math.random();
        const newUpload = {
            id: uploadId,
            fileName: payload.name,
            progress: 0,
            status: 'starting',
            countdown: 30,
        };
        uploads.push(newUpload);
        broadcastState();

        dataUrlToBlob(payload.dataUrl)
            .then(blob => new File([blob], payload.name, { type: payload.type }))
            .then(file => startUpload(uploadId, file))
            .catch(error => {
                console.error('File conversion failed:', error);
                const upload = uploads.find(u => u.id === uploadId);
                if (upload) {
                    upload.status = 'error';
                    broadcastState();
                }
            });
        return true;
    }

    if (type === 'requestInitialState') {
        // A UI has loaded and is requesting the current state
        broadcastState();
    }
});