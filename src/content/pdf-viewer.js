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

    // Menu Item 1: Save to pCloud (Same as FAB click, but explicit option in menu)
    // Actually, user spec says: "icon 點擊以後會往下展開兩個" (Clicking icon expands two options)
    // AND "UI以半透明呈現，當 hover 時，再些微放大並且改為全實現。" (Semi-transparent, hover -> opaque)

    // Clarification: 
    // Spec: "icon 點擊以後會往下展開兩個" -> Click opens menu.
    // Previous plan: "Main Fab: Save to pCloud", "Dropdown: Toggle menu".
    // User latest request: "icon 點擊以後會往下展開兩個" -> The icon itself is the toggle?
    // Let's implement: Click FAB -> Toggle Menu. Menu has 2 items: "Save PDF to pCloud", "Save Markdown to pCloud".

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

function showToast(message, type = 'info') {
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
        showToast(chrome.i18n.getMessage('pdf_error_fetch_failed') || 'Failed to fetch PDF data.', 'error');
        return null;
    }
}

async function handleDownloadToPCloud() {
    console.log('[pCloud] "Download to pCloud" clicked');
    // Close menu
    document.getElementById('pcloud-pdf-menu')?.classList.remove('show');

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
        showToast(chrome.i18n.getMessage('toast_upload_started') || 'Upload started!');
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
    document.getElementById('pcloud-pdf-menu')?.classList.remove('show');

    const isPremium = await checkPremium();
    if (!isPremium) {
        showToast(chrome.i18n.getMessage('notification_premium_required_message') || 'Premium license required!', 'error');
        return;
    }

    showToast(chrome.i18n.getMessage('toast_generating_document') || 'Converting...', 'info');

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
            showToast(chrome.i18n.getMessage('toast_upload_started') || 'Conversion done. Upload started!');
        };
        reader.readAsDataURL(blobMd);

    } catch (e) {
        console.error(e);
        showToast('Conversion failed: ' + e.message, 'error');
    }
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPdfViewerIntegration);
} else {
    initPdfViewerIntegration();
}
