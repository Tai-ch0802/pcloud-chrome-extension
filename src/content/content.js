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
            chrome.runtime.sendMessage({
                type: 'startUploadFromUrl',
                payload: { imageUrl }
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