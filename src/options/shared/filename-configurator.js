export function initializeFilenameConfigurator({ listEl, previewEl, storageKey, defaultConfig, extension }) {
    let mdcInstances = [];

    const dateFormatOptions = [
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
        { value: 'YYYY_MM_DD', label: 'YYYY_MM_DD' },
        { value: 'YYYYMMDD', label: 'YYYYMMDD' },
        { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY' },
        { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' }
    ];

    function formatDate(format) {
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
            const customValue = item.querySelector('.free-key-input')?.value || 'content';
            const dateFormat = item.querySelector('.date-format-select')?.value || 'YYYY-MM-DD';

            if (isEnabled) {
                let value;
                if (id === 'FREE_KEY') {
                    value = customValue;
                } else if (id === 'DATE') {
                    value = formatDate(dateFormat);
                } else {
                    value = sampleData[id];
                }
                if (value) {
                    preview += value + separator;
                }
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
                separator: item.querySelector('.separator-input').value,
                customValue: item.querySelector('.free-key-input')?.value || 'content',
                dateFormat: item.querySelector('.date-format-select')?.value || 'YYYY-MM-DD'
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

            // Build the input field based on part type
            let customFieldHtml = '';
            if (part.id === 'FREE_KEY') {
                customFieldHtml = `<input type="text" class="free-key-input" value="${part.customValue || 'content'}" placeholder="content" style="margin-left: 8px; width: 80px;">`;
            } else if (part.id === 'DATE') {
                const options = dateFormatOptions.map(opt =>
                    `<option value="${opt.value}" ${part.dateFormat === opt.value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                customFieldHtml = `<select class="date-format-select" style="margin-left: 8px; padding: 4px 8px; border-radius: 4px; border: 1px solid #555; background: #2a2a2a; color: #fff;">${options}</select>`;
            }

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
                ${customFieldHtml}
                <label class="separator-label">${chrome.i18n.getMessage('options_filename_separator_label')}:</label>
                <input type="text" class="separator-input" value="${part.separator}" maxlength="3">
            `;

            const checkbox = li.querySelector('.mdc-checkbox');
            const checkboxInput = li.querySelector('.mdc-checkbox__native-control');
            const separatorInput = li.querySelector('.separator-input');
            const freeKeyInput = li.querySelector('.free-key-input');
            const dateFormatSelect = li.querySelector('.date-format-select');

            checkboxInput.checked = part.enabled;
            const mdcCheckbox = new mdc.checkbox.MDCCheckbox(checkbox);
            mdcInstances.push(mdcCheckbox);

            checkbox.addEventListener('change', saveConfig);
            separatorInput.addEventListener('input', saveConfig);
            if (freeKeyInput) {
                freeKeyInput.addEventListener('input', saveConfig);
            }
            if (dateFormatSelect) {
                dateFormatSelect.addEventListener('change', saveConfig);
            }

            listEl.appendChild(li);
        });
    }

    async function load() {
        const { [storageKey]: savedConfig } = await chrome.storage.sync.get(storageKey);

        let finalConfig = defaultConfig;
        if (savedConfig) {
            // Merge saved config with default config to ensure new items (like DATE) are present
            // 1. Keep existing saved items (preserving order and enabled state)
            // 2. Add any new items from defaultConfig that are missing in savedConfig

            const savedIds = new Set(savedConfig.map(item => item.id));
            const newItems = defaultConfig.filter(item => !savedIds.has(item.id));

            // We want to respect the user's order, but new items need to go somewhere.
            // Appending them to the end is a safe default.
            finalConfig = [...savedConfig, ...newItems];
        }

        render(finalConfig);
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
