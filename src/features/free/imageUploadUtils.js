import PCloudAPIClient from '../../core/pcloud-api.js';

const FILENAME_CONFIG_KEY = 'filename_config';
const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';
const DEFAULT_UPLOAD_FOLDER_PATH_KEY = 'default_upload_folder_path';

const defaultFilenameConfig = [
    { id: 'SORTING_NUMBER', labelKey: 'options_filename_part_sorting_number', enabled: true, separator: '_' },
    { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '_' },
    { id: 'TIMESTAMP', labelKey: 'options_filename_part_timestamp', enabled: true, separator: '' }
];

// --- Helper to get file extension from MIME type ---
export function getExtensionFromMime(mimeType) {
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
export function getFormattedTimestamp() {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
}

/**
 * Processes an image blob for upload: generates filename based on config and ensures target folder exists.
 * @param {Blob} blob - The image blob.
 * @param {string} pageTitle - The title of the page the image was found on.
 * @param {string} authToken - The pCloud auth token.
 * @returns {Promise<{file: File, folderId: number}>}
 */
export async function processImageUpload(blob, pageTitle, authToken) {
    // --- Get configs from storage ---
    const {
        [FILENAME_CONFIG_KEY]: config = defaultFilenameConfig,
        [DEFAULT_UPLOAD_FOLDER_PATH_KEY]: basePath = '/',
        [DEFAULT_UPLOAD_FOLDER_ID_KEY]: baseFolderId = 0
    } = await chrome.storage.sync.get([FILENAME_CONFIG_KEY, DEFAULT_UPLOAD_FOLDER_PATH_KEY, DEFAULT_UPLOAD_FOLDER_ID_KEY]);

    const nameParts = {
        SORTING_NUMBER: Date.now(),
        PAGE_TITLE: (pageTitle || 'Untitled').replace(/[\\/:*?"<>|]/g, '_').substring(0, 100),
        TIMESTAMP: getFormattedTimestamp()
    };

    // --- Build path and filename from config ---
    let fullPathString = '';
    const enabledParts = config.filter(p => p.enabled);
    enabledParts.forEach(part => {
        fullPathString += nameParts[part.id] + part.separator;
    });

    const allPathSegments = fullPathString.split('/').map(s => s.trim()).filter(s => s);
    const finalBasename = allPathSegments.pop() || nameParts.SORTING_NUMBER.toString();
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

    const extension = getExtensionFromMime(blob.type);
    const filename = finalBasename.replace(/\/$/, '') + extension;
    const file = new File([blob], filename, { type: blob.type });

    return { file, folderId: targetFolderId };
}
