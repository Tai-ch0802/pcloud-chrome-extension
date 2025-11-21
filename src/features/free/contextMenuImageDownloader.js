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

    try {
        const response = await fetch(info.srcUrl);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
        const blob = await response.blob();

        const { file, folderId } = await processImageUpload(blob, tab.title, authToken);

        initiateUpload(file, { showNotifications: true, folderId: folderId });
    } catch (error) {
        console.error("Context menu upload failed:", error);
        chrome.notifications.create({
            type: 'basic',
            iconUrl: PCLOUD_ICON_PATH,
            title: chrome.i18n.getMessage('notification_upload_error_title'),
            message: chrome.i18n.getMessage('notification_upload_error_message'),
        });
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
