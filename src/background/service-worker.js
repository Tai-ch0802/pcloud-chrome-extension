// src/background/service-worker.js

import { getAuthToken } from '../core/auth.js';
import PCloudAPIClient from '../core/pcloud-api.js';
import { initializeContextMenuImageDownloader } from '../features/free/contextMenuImageDownloader.js';
import { initializeContextMenuTextDownloader } from '../features/free/contextMenuTextUploader.js';
import { initializeContextMenuDocumentDownloader } from '../features/paid/contextMenuDocumentDownloader.js';
import { processImageUpload } from '../features/free/imageUploadUtils.js';


// --- Centralized Global State ---
let uploads = [];
const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';
const PCLOUD_ICON_PATH = '/src/assets/icons/icon128.png';

// --- Initialize Features ---
initializeContextMenuImageDownloader(initiateUpload);
initializeContextMenuTextDownloader(initiateUpload);
initializeContextMenuDocumentDownloader(initiateUpload);

// --- Helper to broadcast state to all UIs ---
function broadcastState() {
    const state = { type: 'uploadStateUpdate', payload: uploads };
    chrome.runtime.sendMessage(state).catch(() => { });
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, state).catch(() => { });
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

    // The initial "upload started" notification is now handled within each feature module
    // to provide more context-specific feedback.

    try {
        const authToken = await getAuthToken();
        if (!authToken) {
            // Auth error is now also handled in the feature module, but this is a good safeguard.
            throw new Error('Not authenticated');
        }

        const client = new PCloudAPIClient(authToken);

        let uploadFolderId = optionFolderId;
        if (uploadFolderId === undefined) {
            const { [DEFAULT_UPLOAD_FOLDER_ID_KEY]: storedFolderId = 0 } = await chrome.storage.sync.get(DEFAULT_UPLOAD_FOLDER_ID_KEY);
            uploadFolderId = storedFolderId;
        }

        upload.folderId = uploadFolderId; // Store folder ID for UI
        upload.status = 'uploading';
        broadcastState();

        // The 'file' parameter is now guaranteed to be a File/Blob object by the feature module.
        const uploadResult = await client.uploadFile(file, uploadFolderId);

        if (uploadResult && uploadResult.metadata) {
            upload.progress = 100;
            upload.status = 'done';
            if (showNotifications) {
                chrome.notifications.create(notificationId, { // Create a new success notification
                    type: 'basic',
                    iconUrl: PCLOUD_ICON_PATH,
                    title: chrome.i18n.getMessage('notification_upload_success_title'),
                    message: file.name, // Use the filename in the success message
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
            chrome.notifications.create(notificationId, { // Create a new error notification
                type: 'basic',
                iconUrl: PCLOUD_ICON_PATH,
                title: chrome.i18n.getMessage('notification_upload_error_title'),
                message: error.message === 'Not authenticated' ? chrome.i18n.getMessage('notification_auth_error_message') : chrome.i18n.getMessage('notification_upload_error_message'),
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
        (async () => {
            try {
                const authToken = await getAuthToken();
                if (!authToken) throw new Error('Not authenticated');

                const response = await fetch(payload.imageUrl);
                const blob = await response.blob();

                const { file, folderId } = await processImageUpload(blob, payload.pageTitle, authToken);

                initiateUpload(file, { showNotifications: false, folderId });
            } catch (error) {
                console.error('URL fetch or processing failed for content script:', error);
            }
        })();
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