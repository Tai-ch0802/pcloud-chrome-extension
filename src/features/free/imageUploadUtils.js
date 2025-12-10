import PCloudAPIClient from '../../core/pcloud-api.js';
import { matchDomainRule } from '../../core/utils.js';

const FILENAME_CONFIG_KEY = 'filename_config';
const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';
const DEFAULT_UPLOAD_FOLDER_PATH_KEY = 'default_upload_folder_path';

const defaultFilenameConfig = [
    { id: 'SORTING_NUMBER', labelKey: 'options_filename_part_sorting_number', enabled: true, separator: '_' },
    { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '/' },
    { id: 'FREE_KEY', labelKey: 'options_filename_part_free_key', enabled: true, separator: '_' },
    { id: 'DATE', labelKey: 'options_filename_part_date', enabled: false, separator: '_', dateFormat: 'YYYY-MM-DD' },
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

// --- Helper to get formatted date ---
export function getFormattedDate(format) {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    switch (format) {
        case 'YYYY-MM-DD': return `${YYYY}-${MM}-${DD}`;
        case 'YYYY_MM_DD': return `${YYYY}_${MM}_${DD}`;
        case 'YYYYMMDD': return `${YYYY}${MM}${DD}`;
        case 'MM-DD-YYYY': return `${MM}-${DD}-${YYYY}`;
        case 'DD-MM-YYYY': return `${DD}-${MM}-${YYYY}`;
        default: return `${YYYY}-${MM}-${DD}`;
    }
}

const DOMAIN_RULES_KEY = 'domain_upload_rules';

/**
 * Processes an image blob for upload: generates filename based on config and ensures target folder exists.
 * @param {Blob} blob - The image blob.
 * @param {string} pageTitle - The title of the page the image was found on.
 * @param {string} authToken - The pCloud auth token.
 * @param {string} sourceUrl - The URL of the page or image source for domain matching.
 * @returns {Promise<{file: File, folderId: number}>}
 */
export async function processImageUpload(blob, pageTitle, authToken, sourceUrl) {
    // --- Get configs from storage ---
    const {
        [FILENAME_CONFIG_KEY]: config = defaultFilenameConfig,
        [DEFAULT_UPLOAD_FOLDER_PATH_KEY]: basePath = '/',
        [DEFAULT_UPLOAD_FOLDER_ID_KEY]: baseFolderId = 0,
        [DOMAIN_RULES_KEY]: domainRules = []
    } = await chrome.storage.sync.get([FILENAME_CONFIG_KEY, DEFAULT_UPLOAD_FOLDER_PATH_KEY, DEFAULT_UPLOAD_FOLDER_ID_KEY, DOMAIN_RULES_KEY]);

    // --- Domain Rule Matching ---
    let targetFolderId = baseFolderId;
    let targetPath = basePath;

    // Use shared utility for matching
    const matchedRule = matchDomainRule(sourceUrl, domainRules);

    if (matchedRule) {
        targetPath = matchedRule.targetPath;
        // If we have a cached folder ID, use it, otherwise we might need to resolve path to ID
        // Ideally, we should resolve path to ID if ID is missing or 0
        if (matchedRule.targetFolderId) {
            targetFolderId = matchedRule.targetFolderId;
        } else {
            // We need to resolve path to ID. 
            // Since we are about to createFolderIfNotExists anyway, we can just use the path.
            // But createFolderIfNotExists takes a path string.
            // Let's rely on createFolderIfNotExists to handle the path and return the ID.
            targetFolderId = 0; // Reset to root so we build full path from root
        }
    }

    const nameParts = {
        SORTING_NUMBER: Date.now(),
        PAGE_TITLE: (pageTitle || 'Untitled').replace(/[\\/:*?"<>|]/g, '_').substring(0, 100),
        TIMESTAMP: getFormattedTimestamp()
    };

    // --- Build path and filename from config ---
    let fullPathString = '';
    const enabledParts = config.filter(p => p.enabled);
    enabledParts.forEach(part => {
        if (part.id === 'FREE_KEY') {
            fullPathString += (part.customValue || 'content') + part.separator;
        } else if (part.id === 'DATE') {
            fullPathString += getFormattedDate(part.dateFormat || 'YYYY-MM-DD') + part.separator;
        } else {
            fullPathString += nameParts[part.id] + part.separator;
        }
    });

    const allPathSegments = fullPathString.split('/').map(s => s.trim()).filter(s => s);
    const finalBasename = allPathSegments.pop() || nameParts.SORTING_NUMBER.toString();
    const subfolderPath = allPathSegments.join('/');

    const client = new PCloudAPIClient(authToken);

    // If we matched a rule, the targetPath is the rule's path.
    // If not, it's the default base path.
    // We append any subfolders defined in the filename config (though usually filename config shouldn't have folders, but logic supports it)

    // Construct the full absolute path for pCloud
    // If targetFolderId is known and valid (non-zero), we could use it, but createFolderIfNotExists works best with paths or we need a method to create by ID + subpath.
    // The current createFolderIfNotExists implementation likely takes a full path string.
    // Let's assume targetPath is absolute like '/MyFolder'.

    let effectiveBasePath = targetPath;
    if (matchedRule && matchedRule.targetFolderId) {
        // Optimization: If we have an ID, we might want to use it directly if no subfolders.
        // But to be safe and consistent, we'll ensure the folder exists by path.
        // Or if we trust the ID, we just use it.
        // For now, let's stick to path-based creation to ensure existence.
    }

    const fullTargetPath = [effectiveBasePath, subfolderPath].join('/').replace(/\/+/g, '/').replace(/\/$/, '');

    if (fullTargetPath && fullTargetPath !== '/') {
        const folderMeta = await client.createFolderIfNotExists(fullTargetPath);
        if (folderMeta && folderMeta.metadata && folderMeta.metadata.folderid) {
            targetFolderId = folderMeta.metadata.folderid;
        }
    } else {
        // Root folder
        targetFolderId = 0;
    }

    const extension = getExtensionFromMime(blob.type);
    const filename = finalBasename.replace(/\/$/, '') + extension;
    const file = new File([blob], filename, { type: blob.type });

    return { file, folderId: targetFolderId };
}
