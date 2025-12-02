import { initializeFilenameConfigurator } from '../../shared/filename-configurator.js';

const TEXT_FILENAME_CONFIG_KEY = 'text_filename_config';
const TEXT_INCLUDE_METADATA_KEY = 'text_include_metadata';

const defaultTextFilenameConfig = [
    { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '/' },
    { id: 'FREE_KEY', labelKey: 'options_filename_part_free_key', enabled: true, separator: '_' },
    { id: 'TIMESTAMP', labelKey: 'options_filename_part_timestamp', enabled: true, separator: '' }
];

export default class TextFilenameSection {
    constructor() {
        this.element = null;
    }

    async render() {
        const response = await fetch(chrome.runtime.getURL('src/options/sections/filename-text/template.html'));
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        this.element = doc.body.firstElementChild;
        return this.element;
    }

    async init() {
        const listEl = this.element.querySelector('#text-filename-parts-list');
        const previewEl = this.element.querySelector('#text-filename-preview');
        const textMetadataCheckbox = this.element.querySelector('#text-include-metadata');

        const configurator = initializeFilenameConfigurator({
            listEl: listEl,
            previewEl: previewEl,
            storageKey: TEXT_FILENAME_CONFIG_KEY,
            defaultConfig: defaultTextFilenameConfig,
            extension: '.md'
        });

        await configurator.load();
        configurator.setupDragAndDrop();

        // Initialize Text Metadata Checkbox
        const { [TEXT_INCLUDE_METADATA_KEY]: savedTextMetadata = false } = await chrome.storage.sync.get(TEXT_INCLUDE_METADATA_KEY);
        textMetadataCheckbox.checked = savedTextMetadata;

        textMetadataCheckbox.addEventListener('change', async () => {
            await chrome.storage.sync.set({ [TEXT_INCLUDE_METADATA_KEY]: textMetadataCheckbox.checked });
            window.dispatchEvent(new CustomEvent('options-saved', { detail: { messageKey: 'options_saved_message' } }));
        });
    }
}
