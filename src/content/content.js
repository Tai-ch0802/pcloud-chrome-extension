// src/content/content.js

let pcloudDragIcon = null;
let pcloudUploadIframe = null;
let isDraggingImage = false;
let dragEndTimeout = null;
let iframeHideTimeout = null;

function createElements() {
    // --- Create Floating Icon ---
    pcloudDragIcon = document.createElement('div');
    pcloudDragIcon.id = 'pcloud-drag-icon';
    const iconUrl = chrome.runtime.getURL('src/assets/icons/icon128.png');
    pcloudDragIcon.innerHTML = `<img src="${iconUrl}" alt="pCloud">`;
    document.body.appendChild(pcloudDragIcon);

    // --- Create Iframe ---
    pcloudUploadIframe = document.createElement('iframe');
    pcloudUploadIframe.id = 'pcloud-upload-iframe';
    pcloudUploadIframe.src = chrome.runtime.getURL('src/content/upload_ui.html');
    document.body.appendChild(pcloudUploadIframe);

    addIconEventListeners();
    addIframeEventListeners();
}

function addIconEventListeners() {
    pcloudDragIcon.addEventListener('dragenter', (e) => {
        e.preventDefault();
        pcloudDragIcon.classList.add('hover'); // Add a hover effect
    });

    pcloudDragIcon.addEventListener('dragleave', (e) => {
        e.preventDefault();
        pcloudDragIcon.classList.remove('hover');
    });

    pcloudDragIcon.addEventListener('drop', (e) => {
        e.preventDefault();
        pcloudDragIcon.classList.remove('hover');
        pcloudDragIcon.classList.remove('visible');

        const imageUrl = e.dataTransfer.getData('text/uri-list');
        if (imageUrl) {
            if (!chrome.runtime?.id) {
                console.error("pCloud Extension: Context invalidated. Please refresh the page.");
                alert("pCloud Extension: Connection lost. Please refresh the page.");
                return;
            }

            chrome.runtime.sendMessage({
                type: 'startUploadFromUrl',
                payload: {
                    imageUrl,
                    pageTitle: document.title
                }
            });
            // Show the iframe immediately to display progress
            pcloudUploadIframe.classList.add('visible');
        }
    });
}

function addIframeEventListeners() {
    // When the mouse leaves the iframe area, hide it after a short delay
    pcloudUploadIframe.addEventListener('mouseleave', (e) => {
        iframeHideTimeout = setTimeout(() => {
            pcloudUploadIframe.classList.remove('visible');
        }, 500);
    });

    // If the mouse re-enters, cancel the hide
    pcloudUploadIframe.addEventListener('mouseenter', (e) => {
        clearTimeout(iframeHideTimeout);
    });
}


// --- Main Listeners on the document ---

document.addEventListener('dragstart', (e) => {
    // Check if the dragged element is an image
    if (e.target.tagName === 'IMG') {
        isDraggingImage = true;
        // Use a timeout to show the icon, avoids flickering
        setTimeout(() => {
            if (isDraggingImage) {
                pcloudDragIcon.classList.add('visible');
            }
        }, 100);
    }
});

document.addEventListener('dragend', (e) => {
    if (isDraggingImage) {
        // Hide icon with a delay to prevent it from disappearing during drop
        dragEndTimeout = setTimeout(() => {
            pcloudDragIcon.classList.remove('visible');
            pcloudUploadIframe.classList.remove('visible');
        }, 200);
        isDraggingImage = false;
    }
});

// Prevent default behavior for dragover to allow drop
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

// When a drop happens anywhere, clear any pending timeouts
document.addEventListener('drop', (e) => {
    // If the drop is on the iframe, let the iframe's own script handle it.
    if (e.target.id === 'pcloud-upload-iframe') {
        return;
    }

    // Otherwise, it was a drop outside our UI, so clean up.
    clearTimeout(dragEndTimeout);
    isDraggingImage = false;
    pcloudDragIcon.classList.remove('visible');
    pcloudUploadIframe.classList.remove('visible');
});


// --- Initialization ---
createElements();

// --- Function to get selected HTML with absolute URLs ---
function getSelectionHtml() {
    let html = "";
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();

        // Resolve relative URLs
        const images = fragment.querySelectorAll('img');
        images.forEach(img => {
            img.src = img.src; // Accessing .src property returns absolute URL
        });
        const links = fragment.querySelectorAll('a');
        links.forEach(a => {
            a.href = a.href; // Accessing .href property returns absolute URL
        });

        const div = document.createElement("div");
        div.appendChild(fragment);
        html = div.innerHTML;
    }
    return html;
}

// --- Helper to embed images into HTML for PDF/DOC generation ---
async function embedImagesInHtml(html, images) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const imgTags = doc.querySelectorAll('img');

    for (let img of imgTags) {
        const src = img.getAttribute('src');
        // Find the base64 data for this image
        // We assume 'images' is an array of { originalUrl, base64Url }
        // But matching might be tricky if src changed.
        // Actually, we can just replace by matching original URL.
        const match = images.find(i => i.originalUrl === src);
        if (match && match.base64Url) {
            img.src = match.base64Url;
        }
    }
    return doc.body.innerHTML;
}

// --- Listener for messages from the background script ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMarkdownFromSelection") {
        const selectedHtml = getSelectionHtml();
        if (selectedHtml && typeof TurndownService === 'function') {
            const turndownService = new TurndownService();
            const markdown = turndownService.turndown(selectedHtml);
            sendResponse({ markdown: markdown });
        } else {
            sendResponse({ markdown: "" });
        }
        return true; // Indicate that sendResponse will be called asynchronously
    }

    if (request.action === "getSelectionData") {
        const selectedHtml = getSelectionHtml();
        let markdown = "";
        if (selectedHtml && typeof TurndownService === 'function') {
            const turndownService = new TurndownService();
            // Configure Turndown to keep images
            turndownService.addRule('keepImages', {
                filter: 'img',
                replacement: function (content, node) {
                    return `![${node.alt}](${node.src})`;
                }
            });
            // Unwrap images from links (e.g. <a href="..."><img ...></a> -> ![...](...))
            turndownService.addRule('unwrapLinkedImages', {
                filter: function (node, options) {
                    return node.nodeName === 'A' && node.querySelector('img');
                },
                replacement: function (content, node) {
                    return content;
                }
            });
            markdown = turndownService.turndown(selectedHtml);
        }
        sendResponse({ html: selectedHtml, markdown: markdown });
        return true;
    }



    if (request.action === "generateDoc") {
        (async () => {
            try {
                const { dataKey } = request;
                const storageData = await chrome.storage.local.get(dataKey);
                const { html, images } = storageData[dataKey];

                const embeddedHtml = await embedImagesInHtml(html, images);

                // Wrap in full HTML for Word
                const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${embeddedHtml}</body></html>`;

                // html-docx-js should be global 'htmlDocx' or similar
                // Check how it's exported. Usually 'htmlDocx'.
                // If it's a module, it might be tricky. But unpkg version is usually UMD/Global.

                let converted = null;
                if (typeof htmlDocx !== 'undefined') {
                    converted = htmlDocx.asBlob(fullHtml);
                } else if (window.htmlDocx) {
                    converted = window.htmlDocx.asBlob(fullHtml);
                } else {
                    throw new Error("html-docx library not found");
                }

                const reader = new FileReader();
                reader.onloadend = () => sendResponse({ dataUrl: reader.result });
                reader.readAsDataURL(converted);
            } catch (e) {
                console.error("DOC Generation Error", e);
                sendResponse({ error: e.message });
            }
        })();
        return true;
    }
    if (request.action === "ping") {
        sendResponse({ status: "pong" });
        return true;
    }
});