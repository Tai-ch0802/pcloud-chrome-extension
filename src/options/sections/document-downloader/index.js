import { initializeFilenameConfigurator } from '../../shared/filename-configurator.js';

const DOC_FILENAME_CONFIG_KEY = 'doc_filename_config';
const DOC_FORMAT_KEY = 'doc_format';
const DOC_INCLUDE_METADATA_KEY = 'doc_include_metadata';

const defaultDocFilenameConfig = [
    { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '_' },
    { id: 'TIMESTAMP', labelKey: 'options_filename_part_timestamp', enabled: true, separator: '' }
];

export default class DocumentDownloaderSection {
    constructor() {
        this.element = null;
        this.docFormatSelect = null;
        this.docMetadataCheckbox = null;
        this.docMetadataContainer = null;
        this.docFilenamePreview = null;
    }

    async render() {
        const response = await fetch(chrome.runtime.getURL('src/options/sections/document-downloader/template.html'));
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        this.element = doc.body.firstElementChild;
        return this.element;
    }

    async init() {
        const listEl = this.element.querySelector('#doc-filename-parts-list');
        this.docFilenamePreview = this.element.querySelector('#doc-filename-preview');
        const docFormatSelectElement = this.element.querySelector('#doc-format-select');
        this.docMetadataCheckbox = this.element.querySelector('#doc-include-metadata');
        this.docMetadataContainer = this.element.querySelector('#doc-metadata-container');

        const configurator = initializeFilenameConfigurator({
            listEl: listEl,
            previewEl: this.docFilenamePreview,
            storageKey: DOC_FILENAME_CONFIG_KEY,
            defaultConfig: defaultDocFilenameConfig,
            extension: '.md' // Initial extension, will update based on format
        });

        await configurator.load();
        configurator.setupDragAndDrop();

        // Initialize Document Format Select
        this.docFormatSelect = new mdc.select.MDCSelect(docFormatSelectElement);
        const { [DOC_FORMAT_KEY]: savedFormat = 'md', [DOC_INCLUDE_METADATA_KEY]: savedMetadata = false } = await chrome.storage.sync.get([DOC_FORMAT_KEY, DOC_INCLUDE_METADATA_KEY]);

        this.docFormatSelect.value = savedFormat;
        this.docMetadataCheckbox.checked = savedMetadata;

        this.updateDocUI();

        this.docFormatSelect.listen('MDCSelect:change', async () => {
            const format = this.docFormatSelect.value;
            await chrome.storage.sync.set({ [DOC_FORMAT_KEY]: format });
            this.updateDocUI();
            window.dispatchEvent(new CustomEvent('options-saved', { detail: { messageKey: 'options_saved_message' } }));
        });

        this.docMetadataCheckbox.addEventListener('change', async () => {
            await chrome.storage.sync.set({ [DOC_INCLUDE_METADATA_KEY]: this.docMetadataCheckbox.checked });
            window.dispatchEvent(new CustomEvent('options-saved', { detail: { messageKey: 'options_saved_message' } }));
        });
    }

    updateDocUI() {
        const format = this.docFormatSelect.value;
        if (format === 'md') {
            this.docMetadataContainer.style.display = 'block';
            const currentPreview = this.docFilenamePreview.textContent;
            this.docFilenamePreview.textContent = currentPreview.replace(/\.[^.]+$/, '.' + format);
        } else {
            this.docMetadataContainer.style.display = 'none';
            const extMap = { 'pdf': 'pdf', 'doc': 'docx' };
            const currentPreview = this.docFilenamePreview.textContent;
            this.docFilenamePreview.textContent = currentPreview.replace(/\.[^.]+$/, '.' + (extMap[format] || format));
        }
    }
}
