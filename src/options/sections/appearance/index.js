const THEME_KEY = 'selected_theme';

export default class AppearanceSection {
    constructor() {
        this.element = null;
        this.themeSelect = null;
    }

    async render() {
        const response = await fetch(chrome.runtime.getURL('src/options/sections/appearance/template.html'));
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        this.element = doc.body.firstElementChild;
        return this.element;
    }

    async init() {
        const themeSelectElement = this.element.querySelector('#theme-select');
        this.themeSelect = new mdc.select.MDCSelect(themeSelectElement);

        await this.loadAndApplyTheme();

        this.themeSelect.listen('MDCSelect:change', async () => {
            const selectedTheme = this.themeSelect.value;
            await chrome.storage.sync.set({ [THEME_KEY]: selectedTheme });
            this.applyTheme(selectedTheme);
        });
    }

    applyTheme(theme) {
        document.documentElement.classList.remove('theme-googlestyle', 'theme-geek');
        document.documentElement.classList.add(theme);
    }

    async loadAndApplyTheme() {
        const { [THEME_KEY]: savedTheme = 'theme-googlestyle' } = await chrome.storage.sync.get(THEME_KEY);
        if (this.themeSelect) {
            this.themeSelect.value = savedTheme;
        }
        this.applyTheme(savedTheme);
    }
}
