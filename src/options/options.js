import AppearanceSection from './sections/appearance/index.js';
import UploadsSection from './sections/uploads/index.js';
import PremiumSection from './sections/premium/index.js';
import DomainRulesSection from './sections/domain-rules/index.js';
import ImageFilenameSection from './sections/filename-image/index.js';
import TextFilenameSection from './sections/filename-text/index.js';
import DocumentDownloaderSection from './sections/document-downloader/index.js';

class OptionsPage {
  constructor() {
    this.sectionsContainer = document.getElementById('sections-container');
    this.snackbar = null;
  }

  async init() {
    // Initialize Snackbar
    const snackbarElement = document.getElementById('app-snackbar');
    this.snackbar = new mdc.snackbar.MDCSnackbar(snackbarElement);

    // Global event listener for status messages
    window.addEventListener('options-saved', (e) => {
      this.showStatusMessage(e.detail.messageKey);
    });

    // Load Sections
    await this.loadSections();

    // Localize static elements (header, etc.)
    this.localizeHtml();
  }

  async loadSections() {
    const sections = [
      new AppearanceSection(),
      new UploadsSection(),
      new PremiumSection(),
      new DomainRulesSection(),
      new ImageFilenameSection(),
      new TextFilenameSection(),
      new DocumentDownloaderSection()
    ];

    for (const section of sections) {
      try {
        const element = await section.render();
        this.sectionsContainer.appendChild(element);
        // Localize the section immediately before initialization
        // This is crucial for MDC components (like Select) that rely on text content
        this.localizeHtml(element);
        await section.init();
      } catch (error) {
        console.error(`Failed to load section ${section.constructor.name}:`, error);
      }
    }

    // Re-run localization for any static content or missed elements
    this.localizeHtml();
  }

  localizeHtml(rootElement = document) {
    rootElement.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const message = chrome.i18n.getMessage(key);
      if (message) {
        const textSpan = el.querySelector('.mdc-list-item__text') || el.querySelector('.mdc-button__label');
        if (textSpan) {
          textSpan.textContent = message;
        } else if (el.matches('h1, h2, p, span, label, div, small')) {
          el.textContent = message;
        }
      }

      // Handle tooltips
      const titleKey = el.dataset.i18nTitle;
      if (titleKey) {
        el.title = chrome.i18n.getMessage(titleKey);
      }
    });
  }

  showStatusMessage(messageKey) {
    if (!this.snackbar) return;
    const message = chrome.i18n.getMessage(messageKey);
    this.snackbar.labelText = message;
    this.snackbar.open();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new OptionsPage();
  page.init();
});