// src/features/free/contextMenuTextUploader.js

import { getAuthToken } from '../../core/auth.js';
import PCloudAPIClient from '../../core/pcloud-api.js';

const PCLOUD_ICON_PATH = '/src/assets/icons/icon128.png';
const TEXT_FILENAME_CONFIG_KEY = 'text_filename_config';
const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';
const DEFAULT_UPLOAD_FOLDER_PATH_KEY = 'default_upload_folder_path';

const defaultTextFilenameConfig = [
    { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '_' },
    { id: 'TIMESTAMP', labelKey: 'options_filename_part_timestamp', enabled: true, separator: '' }
];

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
            type: 'basic', iconUrl: PCLOUD_ICON_PATH,
            title: chrome.i18n.getMessage('notification_upload_error_title'),
            message: chrome.i18n.getMessage('notification_auth_error_message'),
        });
        return;
    }

    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "getMarkdownFromSelection" });
        if (!response || typeof response.markdown === 'undefined') {
            throw new Error("No valid response from content script.");
        }

        let markdown = response.markdown;
        if (!markdown) {
            chrome.notifications.create({
                type: 'basic', iconUrl: PCLOUD_ICON_PATH,
                title: chrome.i18n.getMessage("notificationUploadTextErrorTitle"),
                message: chrome.i18n.getMessage("notificationUploadTextErrorMessage")
            });
            return;
        }

        // Post-processing: Unwrap images that are wrapped in links
        // Pattern: [ \n ![]() \n ](link) -> ![]()
        markdown = markdown.replace(/\[\s*(!\[.*?\]\(.*?\))\s*\]\(.*?\)/g, '$1');

        // Post-processing: Collapse excessive newlines
        markdown = markdown.replace(/\n{3,}/g, '\n\n');

        const {
            [TEXT_FILENAME_CONFIG_KEY]: config = defaultTextFilenameConfig,
            [DEFAULT_UPLOAD_FOLDER_PATH_KEY]: basePath = '/',
            [DEFAULT_UPLOAD_FOLDER_ID_KEY]: baseFolderId = 0
        } = await chrome.storage.sync.get([TEXT_FILENAME_CONFIG_KEY, DEFAULT_UPLOAD_FOLDER_PATH_KEY, DEFAULT_UPLOAD_FOLDER_ID_KEY]);

        const nameParts = {
            PAGE_TITLE: (tab.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '_').substring(0, 100),
            TIMESTAMP: getFormattedTimestamp()
        };

        let fullPathString = '';
        const enabledParts = config.filter(p => p.enabled);
        enabledParts.forEach(part => {
            if (nameParts[part.id]) {
                fullPathString += nameParts[part.id] + part.separator;
            }
        });

        const allPathSegments = fullPathString.split('/').map(s => s.trim()).filter(s => s);
        const finalBasename = allPathSegments.pop() || nameParts.TIMESTAMP.toString();
        const subfolderPath = allPathSegments.join('/');

        let targetFolderId = baseFolderId;

        if (subfolderPath) {
            const client = new PCloudAPIClient(authToken);
            const fullTargetPath = [basePath, subfolderPath].join('/').replace(/\/+/g, '/').replace(/\/$/, '');

            if (fullTargetPath && fullTargetPath !== '/') {
                const folderMeta = await client.createFolderIfNotExists(fullTargetPath);
                if (folderMeta && folderMeta.metadata && folderMeta.metadata.folderid) {
                    targetFolderId = folderMeta.metadata.folderid;
                }
            }
        }

        const filename = finalBasename.replace(/\/$/, '') + '.md';
        const fileToUpload = new File([new Blob([markdown], { type: 'text/markdown' })], filename, { type: 'text/markdown' });

        initiateUpload(fileToUpload, { showNotifications: true, folderId: targetFolderId });

    } catch (error) {
        console.error("Error uploading selected text:", error);
        let message = chrome.i18n.getMessage("notificationUploadTextErrorMessage");
        if (error.message && (error.message.includes("Receiving end does not exist") || error.message.includes("No valid response"))) {
            message = chrome.i18n.getMessage("notification_error_stale_content_script");
        }
        chrome.notifications.create('', {
            type: 'basic', iconUrl: PCLOUD_ICON_PATH,
            title: chrome.i18n.getMessage("notificationUploadTextErrorTitle"),
            message: message
        });
    }
}

export function initializeContextMenuTextDownloader(initiateUpload) {
    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: 'uploadSelectedText',
            title: chrome.i18n.getMessage('contextMenuItemUploadSelection'),
            contexts: ['selection'],
        });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'uploadSelectedText') {
            handleContextMenuClick(info, tab, initiateUpload);
        }
    });
}
