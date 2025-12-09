// src/content/pdf-viewer.js

// This script injects the "Download to pCloud" floating overlay into the Chrome PDF Viewer.

// import { convertPdfToMarkdown } from '../core/pdf-to-markdown.js'; // Loaded via manifest

const PCLOUD_ICON_SVG = `
<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
</svg>`;

const DOWNLOAD_ICON_SVG = `
<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>
</svg>`;

const MD_ICON_SVG = `
<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12C21.35 6 22 6.63 22 7.41v9.18c0 .78-.65 1.41-1.44 1.41zM6.38 15h2l1.62-5.4 1.62 5.4h2L15.5 8h-1.68l-1.08 4.2L11.56 8H10.4l-1.16 4.2L8.14 8H6.5l-.12 7zM18 13.5V11h-1.5v-1h4v1H19v2.5h-1z"/>
</svg>`;

async function initPdfViewerIntegration() {
    console.log('[pCloud] initPdfViewerIntegration called. Content-Type:', document.contentType, 'URL:', window.location.href);

    // Check if we are viewing a PDF
    // 1. Direct content type check
    // 2. URL ends with .pdf
    // 3. Existence of <embed type="application/pdf">

    const isPdfContentType = document.contentType === 'application/pdf';
    const isPdfUrl = window.location.href.toLowerCase().endsWith('.pdf');
    const hasPdfEmbed = !!document.querySelector('embed[type="application/pdf"]');

    if (!isPdfContentType && !isPdfUrl && !hasPdfEmbed) {
        console.log('[pCloud] Not a PDF page. Skipping integration.');
        return;
    }

    console.log('[pCloud] PDF Viewer detected. Injecting Overlay...');
    injectOverlay();
}

function injectOverlay() {
    if (document.getElementById('pcloud-pdf-overlay')) return;

    const style = document.createElement('style');
    style.textContent = `
        #pcloud-pdf-overlay-styles {
            font-family: 'Roboto', 'Segoe UI', Tahoma, sans-serif;
        }
        #pcloud-pdf-overlay {
            position: fixed;
            top: 60px;
            right: 20px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            pointer-events: none;
            z-index: 2147483647; /* Ensure it's on top */
        }
        #pcloud-pdf-overlay > * {
            pointer-events: auto;
        }
        #pcloud-pdf-fab {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: #333;
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease-in-out;
            opacity: 0.5;
            margin-bottom: 10px;
        }
        #pcloud-pdf-fab:hover {
            opacity: 1;
            transform: scale(1.1);
            background-color: #000;
        }
        #pcloud-pdf-fab svg {
            width: 24px;
            height: 24px;
            fill: currentColor;
        }
        #pcloud-pdf-menu {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            min-width: 200px;
            display: none;
            flex-direction: column;
            animation: fadeIn 0.2s;
            margin-right: 5px;
        }
        #pcloud-pdf-menu.show {
            display: flex;
        }
        .pcloud-pdf-menu-item {
            padding: 12px 16px;
            cursor: pointer;
            font-size: 14px;
            color: #333;
            display: flex;
            align-items: center;
            transition: background-color 0.1s;
            background: none;
            border: none;
            text-align: left;
            width: 100%;
        }
        .pcloud-pdf-menu-item:hover {
            background-color: #f5f5f5;
        }
        .pcloud-pdf-menu-item svg {
            margin-right: 10px;
            width: 18px;
            height: 18px;
            fill: #666;
        }
        /* Toast Styles */
        .pcloud-pdf-toast {
            margin-top: 10px;
            background-color: #323232;
            color: white;
            padding: 14px 24px;
            border-radius: 4px;
            box-shadow: 0 3px 5px -1px rgba(0, 0, 0, .2), 0 6px 10px 0 rgba(0, 0, 0, .14), 0 1px 18px 0 rgba(0, 0, 0, .12);
            font-size: 14px;
            opacity: 0;
            transform: translateY(-10px);
            transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 300px;
        }
        .pcloud-pdf-toast.show {
            opacity: 1;
            transform: translateY(0);
        }
        .pcloud-pdf-toast.error {
            background-color: #d32f2f;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    style.id = 'pcloud-pdf-overlay-styles';
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'pcloud-pdf-overlay';

    // FAB Logic
    const fab = document.createElement('button');
    fab.id = 'pcloud-pdf-fab';
    fab.title = chrome.i18n.getMessage('pdf_download_to_pcloud') || 'Save to pCloud';
    fab.innerHTML = PCLOUD_ICON_SVG;

    // Menu Logic
    const menu = document.createElement('div');
    menu.id = 'pcloud-pdf-menu';

    fab.onclick = (e) => {
        e.stopPropagation();
        toggleMenu();
    };

    // Option 1: Save PDF
    const itemPdf = document.createElement('button');
    itemPdf.className = 'pcloud-pdf-menu-item';
    itemPdf.innerHTML = `${DOWNLOAD_ICON_SVG} <span>${chrome.i18n.getMessage('pdf_download_to_pcloud') || 'Save PDF to pCloud'}</span>`;
    itemPdf.onclick = handleDownloadToPCloud;

    // Option 2: Save Markdown
    const itemMd = document.createElement('button');
    itemMd.className = 'pcloud-pdf-menu-item';
    itemMd.innerHTML = `${MD_ICON_SVG} <span>${chrome.i18n.getMessage('pdf_download_as_markdown') || 'Save Markdown (Premium)'}</span>`;
    itemMd.onclick = handleDownloadAsMarkdown;

    menu.appendChild(itemPdf);
    menu.appendChild(itemMd);

    overlay.appendChild(fab);
    overlay.appendChild(menu);

    document.body.appendChild(overlay);

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!overlay.contains(e.target)) {
            menu.classList.remove('show');
        }
    });

    function toggleMenu() {
        menu.classList.toggle('show');
    }
}

function showPdfToast(message, type = 'info') {
    const overlay = document.getElementById('pcloud-pdf-overlay');
    if (!overlay) return;

    const toast = document.createElement('div');
    toast.className = `pcloud-pdf-toast ${type}`;
    toast.textContent = message;

    // Append to overlay (will stack below button/menu)
    overlay.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function getPdfData() {
    const url = window.location.href;
    console.log('[pCloud] Fetching PDF from:', url);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');

        let filename = null;

        // 1. Try Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            const match = contentDisposition.match(/filename=['"]?([^'"]+)['"]?/);
            if (match && match[1]) {
                filename = decodeURIComponent(match[1]);
            }
        }

        // 2. Try URL path
        if (!filename) {
            try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const configPath = pathname.substring(pathname.lastIndexOf('/') + 1);
                if (configPath && configPath.toLowerCase().includes('.pdf')) {
                    filename = decodeURIComponent(configPath);
                }
            } catch (e) {
                console.warn('[pCloud] Failed to parse URL for filename:', e);
            }
        }

        // 3. Fallback to document title
        if (!filename) {
            const title = document.title;
            if (title && title !== 'PDF Viewer' && title.trim() !== '') {
                filename = title.endsWith('.pdf') ? title : title + '.pdf';
            }
        }

        // 4. Fallback to generic name
        if (!filename) {
            filename = `document_${Date.now()}.pdf`;
        }

        return {
            blob: await response.blob(),
            filename: filename
        };

    } catch (e) {
        console.error('[pCloud] Failed to fetch PDF:', e);
        showPdfToast(chrome.i18n.getMessage('pdf_error_fetch_failed') || 'Failed to fetch PDF data.', 'error');
        return null;
    }
}

async function handleDownloadToPCloud() {
    console.log('[pCloud] "Download to pCloud" clicked');
    // Close menu
    // Close menu
    pcloudPdfShadow?.getElementById('pcloud-pdf-menu')?.classList.remove('show');

    const pdfData = await getPdfData();
    if (!pdfData) return;

    const { blob, filename } = pdfData;

    const reader = new FileReader();
    reader.onload = () => {
        chrome.runtime.sendMessage({
            type: 'startUploadFromFile',
            payload: {
                name: filename,
                type: 'application/pdf',
                dataUrl: reader.result,
                sourceUrl: window.location.href
            }
        });
        showPdfToast(chrome.i18n.getMessage('toast_upload_started') || 'Upload started!');
    };
    reader.readAsDataURL(blob);
}

async function checkPremium() {
    try {
        const { hyperfetch_license } = await chrome.storage.sync.get('hyperfetch_license');
        return hyperfetch_license && (hyperfetch_license.status === 'premium' || hyperfetch_license.status === 'master');
    } catch (e) {
        console.error('[pCloud] Failed to check license:', e);
        return false;
    }
}

async function handleDownloadAsMarkdown() {
    console.log('[pCloud] "Download as Markdown" clicked');
    // Close menu
    // Close menu
    pcloudPdfShadow?.getElementById('pcloud-pdf-menu')?.classList.remove('show');

    const isPremium = await checkPremium();
    if (!isPremium) {
        showPdfToast(chrome.i18n.getMessage('notification_premium_required_message') || 'Premium license required!', 'error');
        return;
    }

    showPdfToast(chrome.i18n.getMessage('toast_generating_document') || 'Converting...', 'info');

    const pdfData = await getPdfData();
    if (!pdfData) return;

    const { blob, filename: originalFilename } = pdfData;

    try {
        const arrayBuffer = await blob.arrayBuffer();
        const markdown = await convertPdfToMarkdown(arrayBuffer);

        // Generate Markdown filename
        const mdFilename = originalFilename.replace(/\.pdf$/i, '') + '.md';

        // Upload Markdown
        const blobMd = new Blob([markdown], { type: 'text/markdown' });
        const reader = new FileReader();
        reader.onload = () => {
            chrome.runtime.sendMessage({
                type: 'startUploadFromFile',
                payload: {
                    name: mdFilename,
                    type: 'text/markdown',
                    dataUrl: reader.result,
                    sourceUrl: window.location.href
                }
            });
            showPdfToast(chrome.i18n.getMessage('toast_upload_started') || 'Conversion done. Upload started!');
        };
        reader.readAsDataURL(blobMd);

    } catch (e) {
        console.error(e);
        showPdfToast('Conversion failed: ' + e.message, 'error');
    }
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPdfViewerIntegration);
} else {
    initPdfViewerIntegration();
}
