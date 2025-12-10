import { initializeFilenameConfigurator } from '../../shared/filename-configurator.js';

const FILENAME_CONFIG_KEY = 'filename_config';

const defaultImageFilenameConfig = [
    { id: 'SORTING_NUMBER', labelKey: 'options_filename_part_sorting_number', enabled: true, separator: '_' },
    { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '/' },
    { id: 'FREE_KEY', labelKey: 'options_filename_part_free_key', enabled: true, separator: '_' },
    { id: 'DATE', labelKey: 'options_filename_part_date', enabled: false, separator: '_', dateFormat: 'YYYY-MM-DD' },
    { id: 'TIMESTAMP', labelKey: 'options_filename_part_timestamp', enabled: true, separator: '' }
];

export default class ImageFilenameSection {
    constructor() {
        this.element = null;
    }

    async render() {
        const response = await fetch(chrome.runtime.getURL('src/options/sections/filename-image/template.html'));
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        this.element = doc.body.firstElementChild;
        return this.element;
    }

    async init() {
        const listEl = this.element.querySelector('#filename-parts-list');
        const previewEl = this.element.querySelector('#filename-preview');

        const configurator = initializeFilenameConfigurator({
            listEl: listEl,
            previewEl: previewEl,
            storageKey: FILENAME_CONFIG_KEY,
            defaultConfig: defaultImageFilenameConfig,
            extension: '.jpg'
        });

        await configurator.load();
        configurator.setupDragAndDrop();
    }
}
