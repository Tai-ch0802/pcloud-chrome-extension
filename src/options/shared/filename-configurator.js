export function initializeFilenameConfigurator({ listEl, previewEl, storageKey, defaultConfig, extension }) {
    let mdcInstances = [];

    function updatePreview() {
        let preview = '';
        const sampleData = {
            SORTING_NUMBER: Date.now(),
            PAGE_TITLE: 'Sample Page Title',
            TIMESTAMP: new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '').replace(' ', '_')
        };

        listEl.querySelectorAll('.filename-part-item').forEach(item => {
            const id = item.dataset.id;
            const isEnabled = item.querySelector('.mdc-checkbox__native-control').checked;
            const separator = item.querySelector('.separator-input').value;

            if (isEnabled && sampleData[id]) {
                preview += sampleData[id] + separator;
            }
        });
        previewEl.textContent = preview.replace(/\/$/, '') + extension;
    }

    async function saveConfig() {
        const config = [];
        listEl.querySelectorAll('.filename-part-item').forEach(item => {
            config.push({
                id: item.dataset.id,
                labelKey: item.dataset.labelKey,
                enabled: item.querySelector('.mdc-checkbox__native-control').checked,
                separator: item.querySelector('.separator-input').value
            });
        });
        await chrome.storage.sync.set({ [storageKey]: config });
        window.dispatchEvent(new CustomEvent('options-saved', { detail: { messageKey: 'options_saved_message' } }));
        updatePreview();
    }

    function render(config) {
        listEl.innerHTML = '';
        mdcInstances.forEach(inst => inst.destroy());
        mdcInstances = [];

        config.forEach(part => {
            const li = document.createElement('li');
            li.className = 'filename-part-item';
            li.dataset.id = part.id;
            li.dataset.labelKey = part.labelKey;
            li.draggable = true;

            li.innerHTML = `
                <span class="drag-handle">⠿</span>
                <div class="mdc-checkbox">
                    <input type="checkbox" class="mdc-checkbox__native-control" id="check-${storageKey}-${part.id}"/>
                    <div class="mdc-checkbox__background">
                        <svg class="mdc-checkbox__checkmark" viewBox="0 0 24 24">
                            <path class="mdc-checkbox__checkmark-path" fill="none" d="M1.73,12.91 8.1,19.28 22.79,4.59"/>
                        </svg>
                        <div class="mdc-checkbox__mixedmark"></div>
                    </div>
                    <div class="mdc-checkbox__ripple"></div>
                </div>
                <label for="check-${storageKey}-${part.id}" class="part-label">${chrome.i18n.getMessage(part.labelKey)}</label>
                <label class="separator-label">${chrome.i18n.getMessage('options_filename_separator_label')}:</label>
                <input type="text" class="separator-input" value="${part.separator}" maxlength="3">
            `;

            const checkbox = li.querySelector('.mdc-checkbox');
            const checkboxInput = li.querySelector('.mdc-checkbox__native-control');
            const separatorInput = li.querySelector('.separator-input');

            checkboxInput.checked = part.enabled;
            const mdcCheckbox = new mdc.checkbox.MDCCheckbox(checkbox);
            mdcInstances.push(mdcCheckbox);

            checkbox.addEventListener('change', saveConfig);
            separatorInput.addEventListener('input', saveConfig);

            listEl.appendChild(li);
        });
    }

    async function load() {
        const { [storageKey]: savedConfig } = await chrome.storage.sync.get(storageKey);
        render(savedConfig || defaultConfig);
        updatePreview();
    }

    function setupDragAndDrop() {
        let draggedItem = null;
        listEl.addEventListener('dragstart', e => {
            draggedItem = e.target.closest('.filename-part-item');
            if (draggedItem) {
                setTimeout(() => draggedItem.classList.add('dragging'), 0);
            }
        });
        listEl.addEventListener('dragend', e => {
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
                draggedItem = null;
                saveConfig();
            }
        });
        listEl.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(listEl, e.clientY);
            const currentElement = listEl.querySelector('.dragging');
            if (currentElement) {
                if (afterElement == null) {
                    listEl.appendChild(currentElement);
                } else {
                    listEl.insertBefore(currentElement, afterElement);
                }
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.filename-part-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    return { load, setupDragAndDrop, updatePreview };
}
