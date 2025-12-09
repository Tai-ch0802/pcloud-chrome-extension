// src/features/free/contextMenuImageDownloader.js

import { getAuthToken } from '../../core/auth.js';
import PCloudAPIClient from '../../core/pcloud-api.js';

import { processImageUpload } from './imageUploadUtils.js';

const PCLOUD_ICON_PATH = '/src/assets/icons/icon128.png';

async function handleContextMenuClick(info, tab, initiateUpload) {
    const authToken = await getAuthToken();
    if (!authToken) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: PCLOUD_ICON_PATH,
            title: chrome.i18n.getMessage('notification_upload_error_title'),
            message: chrome.i18n.getMessage('notification_auth_error_message'),
        });
        return;
    }

    // Helper to send toast
    // Helper to send toast with fallback to native notification
    const sendToast = async (message, type = 'loading', duration = 0) => {
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: "showToast",
                message,
                toastType: type,
                duration
            });
        } catch (e) {
            console.warn("Could not send toast to tab. Falling back to notification.", e);
            // Fallback: Use native notification for critical errors or success
            if (type === 'error' || type === 'success') {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: PCLOUD_ICON_PATH,
                    title: type === 'error' ? 'Error' : 'Success',
                    message: message
                });
            }
        }
    };

    await sendToast(chrome.i18n.getMessage('notification_document_processing_message'), 'loading');

    try {
        const response = await fetch(info.srcUrl);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
        const blob = await response.blob();

        const { file, folderId } = await processImageUpload(blob, tab.title, authToken, info.pageUrl);

        await sendToast(chrome.i18n.getMessage('toast_uploading_to_pcloud'), 'loading');
        initiateUpload(file, { showNotifications: true, folderId: folderId });
        await sendToast(chrome.i18n.getMessage('toast_upload_started'), 'success', 3000);
    } catch (error) {
        console.error("Context menu upload failed:", error);
        await sendToast(chrome.i18n.getMessage('notification_upload_error_message'), 'error', 5000);
    }
}

export function initializeContextMenuImageDownloader(initiateUpload) {
    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: 'pcloud-save-image',
            title: chrome.i18n.getMessage('context_menu_save_image'),
            contexts: ['image'],
        });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'pcloud-save-image') {
            handleContextMenuClick(info, tab, initiateUpload);
        }
    });
}
