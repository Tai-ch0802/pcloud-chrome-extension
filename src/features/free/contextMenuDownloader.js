// src/features/free/contextMenuDownloader.js

import { getAuthToken } from '../../core/auth.js';

const PCLOUD_ICON_PATH = '/src/assets/icons/icon128.png';
const FILENAME_CONFIG_KEY = 'filename_config';

const defaultFilenameConfig = [
    { id: 'SORTING_NUMBER', labelKey: 'options_filename_part_sorting_number', enabled: true, separator: '_' },
    { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '_' },
    { id: 'TIMESTAMP', labelKey: 'options_filename_part_timestamp', enabled: true, separator: '' }
];

// --- Helper to get file extension from MIME type ---
function getExtensionFromMime(mimeType) {
    if (!mimeType) return '.jpg';
    const mime = mimeType.split(';')[0].trim();
    const map = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'image/bmp': '.bmp',
    };
    return map[mime] || '.jpg';
}

// --- Helper to get formatted timestamp ---
function getFormattedTimestamp() {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
}

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

        // --- Build Filename from Config ---
        const { [FILENAME_CONFIG_KEY]: config = defaultFilenameConfig } = await chrome.storage.sync.get(FILENAME_CONFIG_KEY);
        
        const nameParts = {
            SORTING_NUMBER: Date.now(),
            PAGE_TITLE: (tab.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '_').substring(0, 100),
            TIMESTAMP: getFormattedTimestamp()
        };

        let basename = '';
        const enabledParts = config.filter(p => p.enabled);
        enabledParts.forEach((part, index) => {
            basename += nameParts[part.id];
            if (index < enabledParts.length - 1) {
                basename += part.separator;
            }
        });
        
        if (!basename) { // Handle case where all parts are disabled
            basename = nameParts.SORTING_NUMBER;
        }

        const extension = getExtensionFromMime(blob.type);
        const filename = basename + extension;
        // --- End Filename Logic ---

        const file = new File([blob], filename, { type: blob.type });

        initiateUpload(file, { showNotifications: true });
    } catch (error) {
        console.error("Context menu upload failed during fetch:", error);
        chrome.notifications.create({
            type: 'basic',
            iconUrl: PCLOUD_ICON_PATH,
            title: chrome.i18n.getMessage('notification_upload_error_title'),
            message: chrome.i18n.getMessage('notification_upload_error_message'),
        });
    }
}

export function initializeContextMenuDownloader(initiateUpload) {
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
