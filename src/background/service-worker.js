// src/background/service-worker.js

import { getAuthToken } from '../core/auth.js';
import PCloudAPIClient from '../core/pcloud-api.js';
import { initializeContextMenuDownloader } from '../features/free/contextMenuImageDownloader.js';

// --- Centralized Global State ---
let uploads = [];
const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';
const PCLOUD_ICON_PATH = '/src/assets/icons/icon128.png';

// --- Initialize Features ---
initializeContextMenuDownloader(initiateUpload);

// --- Helper to broadcast state to all UIs ---
function broadcastState() {
    const state = { type: 'uploadStateUpdate', payload: uploads };
    chrome.runtime.sendMessage(state).catch(() => {});
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, state).catch(() => {});
        });
    });
}

// --- Unified Upload Initiation ---
function initiateUpload(file, options = {}) {
    const uploadId = Date.now() + '-' + Math.random();
    const newUpload = {
        id: uploadId,
        fileName: file.name,
        progress: 0,
        status: 'starting',
        countdown: 30,
    };
    uploads.unshift(newUpload); // Add to the top of the list
    broadcastState();
    startUpload(uploadId, file, options);
}

// --- Core Upload Logic ---
async function startUpload(uploadId, file, options = {}) {
    const { showNotifications = false, folderId: optionFolderId } = options;
    const upload = uploads.find(u => u.id === uploadId);
    if (!upload) return;

    const notificationId = `notification-${uploadId}`;

    if (showNotifications) {
        chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: PCLOUD_ICON_PATH,
            title: chrome.i18n.getMessage('notification_upload_started_title'),
            message: chrome.i18n.getMessage('notification_upload_started_message'),
            silent: true,
        });
    }

    try {
        const authToken = await getAuthToken();
        if (!authToken) throw new Error('Not authenticated');
        
        const client = new PCloudAPIClient(authToken);
        
        let uploadFolderId = optionFolderId;
        if (uploadFolderId === undefined) {
            const { [DEFAULT_UPLOAD_FOLDER_ID_KEY]: storedFolderId = 0 } = await chrome.storage.sync.get(DEFAULT_UPLOAD_FOLDER_ID_KEY);
            uploadFolderId = storedFolderId;
        }

        upload.status = 'uploading';
        broadcastState();

        const result = await client.uploadFile(file, uploadFolderId);

        if (result.metadata && result.metadata.length > 0) {
            upload.progress = 100;
            upload.status = 'done';
            if (showNotifications) {
                chrome.notifications.update(notificationId, {
                    title: chrome.i18n.getMessage('notification_upload_success_title'),
                    message: chrome.i18n.getMessage('notification_upload_success_message'),
                });
            }
            
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
        }
        if (showNotifications) {
            chrome.notifications.update(notificationId, {
                title: chrome.i18n.getMessage('notification_upload_error_title'),
                message: chrome.i18n.getMessage('notification_upload_error_message'),
            });
        }
    } finally {
        broadcastState();
    }
}

// --- Main Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    if (type === 'startUploadFromUrl' && payload.imageUrl) {
        fetch(payload.imageUrl)
            .then(response => response.blob())
            .then(blob => new File([blob], payload.fileName, { type: blob.type }))
            .then(file => initiateUpload(file, { showNotifications: false }))
            .catch(error => console.error('URL fetch failed for content script:', error));
        return true;
    }
    
    if (type === 'startUploadFromFile' && payload.dataUrl) {
        fetch(payload.dataUrl)
            .then(res => res.blob())
            .then(blob => new File([blob], payload.name, { type: payload.type }))
            .then(file => initiateUpload(file, { showNotifications: false }))
            .catch(error => console.error('File conversion failed for popup:', error));
        return true;
    }

    if (type === 'requestInitialState') {
        broadcastState();
    }
});