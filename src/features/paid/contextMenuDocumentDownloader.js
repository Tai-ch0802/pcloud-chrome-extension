// src/features/paid/contextMenuDocumentDownloader.js

import { getAuthToken } from '../../core/auth.js';
import PCloudAPIClient from '../../core/pcloud-api.js';
import { licenseManager } from '../../core/license-manager.js';
import { matchDomainRule } from '../../core/utils.js';

const PCLOUD_ICON_PATH = '/src/assets/icons/icon128.png';
const DOC_FILENAME_CONFIG_KEY = 'doc_filename_config';
const DOC_FORMAT_KEY = 'doc_format';
const DOC_INCLUDE_METADATA_KEY = 'doc_include_metadata';
const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';
const DEFAULT_UPLOAD_FOLDER_PATH_KEY = 'default_upload_folder_path';
const DOMAIN_RULES_KEY = 'domain_upload_rules';

const defaultDocFilenameConfig = [
    { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '/' },
    { id: 'FREE_KEY', labelKey: 'options_filename_part_free_key', enabled: true, separator: '_' },
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

async function fetchImageAsBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ blob, base64: reader.result });
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Failed to fetch image:", url, error);
        return null;
    }
}

async function handleContextMenuClick(info, tab, initiateUpload) {
    // Check for Premium License
    await licenseManager.init();
    if (!licenseManager.isPremium()) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: PCLOUD_ICON_PATH,
            title: chrome.i18n.getMessage('notification_premium_required_title'),
            message: chrome.i18n.getMessage('notification_premium_required_message'),
            buttons: [{ title: chrome.i18n.getMessage('notification_premium_upgrade_button') }]
        }, (notificationId) => {
            // Add listener for button click to open options page
            const listener = (clickedId, buttonIndex) => {
                if (clickedId === notificationId && buttonIndex === 0) {
                    chrome.runtime.openOptionsPage();
                    chrome.notifications.onButtonClicked.removeListener(listener);
                }
            };
            chrome.notifications.onButtonClicked.addListener(listener);
        });
        return;
    }

    const authToken = await getAuthToken();
    if (!authToken) {
        chrome.notifications.create({
            type: 'basic', iconUrl: PCLOUD_ICON_PATH,
            title: chrome.i18n.getMessage('notification_auth_error_message'),
            message: chrome.i18n.getMessage('notification_auth_error_message'),
        });
        return;
    }

    // Notify user: Processing (Toast)
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
        // 0. Connectivity Check
        try {
            await chrome.tabs.sendMessage(tab.id, { action: "ping" });
        } catch (e) {
            throw new Error(chrome.i18n.getMessage('error_connection_lost_refresh'));
        }

        // 1. Get Selection Data (HTML + Markdown)
        const response = await chrome.tabs.sendMessage(tab.id, { action: "getSelectionData" });
        if (!response || (!response.html && !response.markdown)) {
            throw new Error("No content selected or content script failed.");
        }

        const { html, markdown } = response;

        // 2. Get Configs
        const {
            [DOC_FILENAME_CONFIG_KEY]: config = defaultDocFilenameConfig,
            [DOC_FORMAT_KEY]: format = 'md',
            [DOC_INCLUDE_METADATA_KEY]: includeMetadata = false,
            [DEFAULT_UPLOAD_FOLDER_PATH_KEY]: basePath = '/',
            [DEFAULT_UPLOAD_FOLDER_ID_KEY]: baseFolderId = 0,
            [DOMAIN_RULES_KEY]: domainRules = []
        } = await chrome.storage.sync.get([
            DOC_FILENAME_CONFIG_KEY, DOC_FORMAT_KEY, DOC_INCLUDE_METADATA_KEY,
            DEFAULT_UPLOAD_FOLDER_PATH_KEY, DEFAULT_UPLOAD_FOLDER_ID_KEY, DOMAIN_RULES_KEY
        ]);

        // --- Domain Rule Matching ---
        let targetFolderId = baseFolderId;
        let targetPath = basePath;

        const matchedRule = matchDomainRule(info.pageUrl, domainRules);

        if (matchedRule) {
            targetPath = matchedRule.targetPath;
            if (matchedRule.targetFolderId) {
                targetFolderId = matchedRule.targetFolderId;
            } else {
                targetFolderId = 0;
            }
        }

        // 3. Determine Filename
        const nameParts = {
            PAGE_TITLE: (tab.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '_').substring(0, 100),
            TIMESTAMP: getFormattedTimestamp()
        };
        let fullPathString = '';
        config.filter(p => p.enabled).forEach(part => {
            if (part.id === 'FREE_KEY') {
                fullPathString += (part.customValue || 'content') + part.separator;
            } else if (nameParts[part.id]) {
                fullPathString += nameParts[part.id] + part.separator;
            }
        });
        const allPathSegments = fullPathString.split('/').map(s => s.trim()).filter(s => s);
        const finalBasename = allPathSegments.pop() || nameParts.TIMESTAMP.toString();
        const subfolderPath = allPathSegments.join('/');

        // 4. Prepare Upload Folder
        const client = new PCloudAPIClient(authToken);
        let fullTargetFolderPath = targetPath;

        if (subfolderPath) {
            fullTargetFolderPath = [targetPath, subfolderPath].join('/').replace(/\/+/g, '/').replace(/\/$/, '');
        }

        if (fullTargetFolderPath && fullTargetFolderPath !== '/') {
            const folderMeta = await client.createFolderIfNotExists(fullTargetFolderPath);
            if (folderMeta?.metadata?.folderid) targetFolderId = folderMeta.metadata.folderid;
        } else {
            // If root and no subfolder, targetFolderId is already set correctly (0 or matchedRule ID)
            if (!matchedRule && !subfolderPath) {
                targetFolderId = baseFolderId;
            }
        }

        // Create a dedicated folder for this document if it has images? 
        // Spec said: "assets/{doc_name}/"
        // Let's create a folder named after the document to keep things clean if there are assets.
        // OR just put assets in `assets` folder.
        // Let's use `assets/{finalBasename}/` for images.

        const assetsFolderName = `assets_${finalBasename}`;
        let assetsFolderId = null;
        let assetsFolderPath = [fullTargetFolderPath, assetsFolderName].join('/').replace(/\/+/g, '/');

        // 5. Extract and Download Images
        // Parse Markdown for images: ![alt](url)
        const imageRegex = /!\[.*?\]\((.*?)\)/g;
        let match;
        const imageUrls = new Set();
        while ((match = imageRegex.exec(markdown)) !== null) {
            imageUrls.add(match[1]);
        }

        const imagesToProcess = Array.from(imageUrls);
        const processedImages = []; // { originalUrl, pCloudPath, base64Url }

        if (imagesToProcess.length > 0) {
            // Create assets folder
            const assetsFolderMeta = await client.createFolderIfNotExists(assetsFolderPath);
            if (assetsFolderMeta?.metadata?.folderid) assetsFolderId = assetsFolderMeta.metadata.folderid;

            let processedCount = 0;
            for (const url of imagesToProcess) {
                processedCount++;
                await sendToast(chrome.i18n.getMessage('toast_processing_images', [processedCount, imagesToProcess.length]), 'loading');

                const result = await fetchImageAsBase64(url);
                if (result) {
                    const { blob, base64 } = result;
                    // Upload to pCloud
                    const ext = blob.type.split('/')[1] || 'png';
                    const imgFilename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;

                    try {
                        const file = new File([blob], imgFilename, { type: blob.type });

                        // Use initiateUpload to show in UI list
                        initiateUpload(file, { showNotifications: false, folderId: assetsFolderId });

                        processedImages.push({
                            originalUrl: url,
                            pCloudPath: `${assetsFolderName}/${imgFilename}`, // Relative to document if doc is in parent
                            base64Url: base64
                        });
                    } catch (err) {
                        console.error("Failed to upload asset", err);
                    }
                }
            }
        }

        // 6. Generate Final Document
        await sendToast(chrome.i18n.getMessage('toast_generating_document'), 'loading');

        let finalFile = null;
        let finalFilename = finalBasename;

        if (format === 'md') {
            let finalMarkdown = markdown;
            // Replace image links
            processedImages.forEach(img => {
                // Escape special regex chars in URL if needed, but simple replace might work
                // Use relative path with ./ prefix for better compatibility
                const relativePath = `./${img.pCloudPath}`;
                finalMarkdown = finalMarkdown.split(img.originalUrl).join(relativePath);
            });

            // Add Metadata
            if (includeMetadata) {
                const metadata = [
                    '---',
                    `title: ${tab.title}`,
                    `source_url: ${tab.url}`,
                    `captured_at: ${new Date().toISOString()}`,
                    '---',
                    '',
                    ''
                ].join('\n');
                finalMarkdown = metadata + finalMarkdown;
            }

            // Post-processing: Unwrap images that are wrapped in links
            // Pattern: [ ![alt](url) ](link) -> ![alt](url)
            finalMarkdown = finalMarkdown.replace(/\[\s*(!\[.*?\]\(.*?\))\s*\]\(.*?\)/g, '$1');

            // Post-processing: Fix broken link patterns
            // Pattern: ][  -> proper spacing
            finalMarkdown = finalMarkdown.replace(/\]\s*\[/g, ']\n\n[');

            // Pattern: Links with excessive line breaks inside
            finalMarkdown = finalMarkdown.replace(/\[([^\]]*?)\n+([^\]]*?)\]/g, '[$1 $2]');

            // Collapse excessive newlines
            finalMarkdown = finalMarkdown.replace(/\n{3,}/g, '\n\n');

            finalFilename += '.md';
            finalFile = new File([new Blob([finalMarkdown], { type: 'text/markdown' })], finalFilename, { type: 'text/markdown' });

        } else if (format === 'doc') {
            // Request DOC generation from Content Script
            console.log("pCloud: Sending generateDoc request.");

            const storageKey = `pcloud_doc_data_${Date.now()}`;
            await chrome.storage.local.set({ [storageKey]: { html, images: processedImages } });

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: "generateDoc",
                dataKey: storageKey
            });

            chrome.storage.local.remove(storageKey);

            if (response.error) throw new Error(response.error);

            const res = await fetch(response.dataUrl);
            const blob = await res.blob();

            finalFilename += '.docx'; // html-docx-js produces docx content usually, or doc? It says 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' usually.
            finalFile = new File([blob], finalFilename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        }

        // 7. Upload Final Document
        if (finalFile) {
            await sendToast(chrome.i18n.getMessage('toast_uploading_to_pcloud'), 'loading');
            // Use initiateUpload to show progress and success
            initiateUpload(finalFile, { showNotifications: true, folderId: targetFolderId });

            // Show success toast briefly before letting initiateUpload handle the rest
            await sendToast(chrome.i18n.getMessage('toast_upload_started'), 'success', 3000);
        }

    } catch (error) {
        console.error("Document download failed:", error);
        await sendToast(`Error: ${error.message}`, 'error', 5000);
    }
}

export function initializeContextMenuDocumentDownloader(initiateUpload) {
    chrome.runtime.onInstalled.addListener(() => {
        chrome.contextMenus.create({
            id: 'pcloud-save-selection',
            title: chrome.i18n.getMessage('context_menu_save_selection'),
            contexts: ['selection'],
        });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'pcloud-save-selection') {
            handleContextMenuClick(info, tab, initiateUpload);
        }
    });
}
