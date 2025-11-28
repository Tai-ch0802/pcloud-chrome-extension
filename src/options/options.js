import { getAuthToken } from '../core/auth.js';
import PCloudAPIClient from '../core/pcloud-api.js';
import { licenseManager } from '../core/license-manager.js';

// --- Storage Keys ---
const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';
const DEFAULT_UPLOAD_FOLDER_PATH_KEY = 'default_upload_folder_path';
const FILENAME_CONFIG_KEY = 'filename_config';
const TEXT_FILENAME_CONFIG_KEY = 'text_filename_config';
const DOC_FILENAME_CONFIG_KEY = 'doc_filename_config';
const DOC_FORMAT_KEY = 'doc_format';
const DOC_INCLUDE_METADATA_KEY = 'doc_include_metadata';
const TEXT_INCLUDE_METADATA_KEY = 'text_include_metadata';
const FOLDER_STATE_KEY = 'folder_collapse_state';
const THEME_KEY = 'selected_theme';
const IS_DEV_MODE = !('update_url' in chrome.runtime.getManifest());

// --- DOM Elements ---
const folderTreeContainer = document.getElementById('folder-tree-container');
const selectedFolderPathDiv = document.getElementById('selected-folder-path');
const devFolderIdSpan = document.getElementById('dev-folder-id');
const themeSelectElement = document.getElementById('theme-select');
const snackbarElement = document.getElementById('app-snackbar');

// Image Filename Elements
const imageFilenamePartsList = document.getElementById('filename-parts-list');
const imageFilenamePreview = document.getElementById('filename-preview');

// Text Filename Elements
const textFilenamePartsList = document.getElementById('text-filename-parts-list');
const textFilenamePreview = document.getElementById('text-filename-preview');
const textMetadataCheckbox = document.getElementById('text-include-metadata');

// Document Downloader Elements
const docFilenamePartsList = document.getElementById('doc-filename-parts-list');
const docFilenamePreview = document.getElementById('doc-filename-preview');
const docFormatSelectElement = document.getElementById('doc-format-select');
const docMetadataCheckbox = document.getElementById('doc-include-metadata');
const docMetadataContainer = document.getElementById('doc-metadata-container');

// --- State ---
let folderCollapseState = {};
let folderMap = new Map();
let themeSelect;
let docFormatSelect;
let snackbar;

const defaultImageFilenameConfig = [
  { id: 'SORTING_NUMBER', labelKey: 'options_filename_part_sorting_number', enabled: true, separator: '_' },
  { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '_' },
  { id: 'TIMESTAMP', labelKey: 'options_filename_part_timestamp', enabled: true, separator: '' }
];

const defaultTextFilenameConfig = [
  { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '_' },
  { id: 'TIMESTAMP', labelKey: 'options_filename_part_timestamp', enabled: true, separator: '' }
];

const defaultDocFilenameConfig = [
  { id: 'PAGE_TITLE', labelKey: 'options_filename_part_page_title', enabled: true, separator: '_' },
  { id: 'TIMESTAMP', labelKey: 'options_filename_part_timestamp', enabled: true, separator: '' }
];

// --- Theme Management ---
function applyTheme(theme) {
  document.documentElement.classList.remove('theme-googlestyle', 'theme-geek');
  document.documentElement.classList.add(theme);
}

async function loadAndApplyTheme() {
  const { [THEME_KEY]: savedTheme = 'theme-googlestyle' } = await chrome.storage.sync.get(THEME_KEY);
  if (themeSelect) {
    themeSelect.value = savedTheme;
  }
  applyTheme(savedTheme);
}

// --- Helper Functions ---
function localizeHtml() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const message = chrome.i18n.getMessage(key);
    if (message) {
      const textSpan = el.querySelector('.mdc-list-item__text') || el.querySelector('.mdc-button__label');
      if (textSpan) {
        textSpan.textContent = message;
      } else if (el.matches('h1, h2, p, span, label, div')) {
        el.textContent = message;
      }
    }
  });
}

function showStatusMessage(messageKey) {
  if (!snackbar) return;
  const message = chrome.i18n.getMessage(messageKey);
  snackbar.labelText = message;
  snackbar.open();
}

// --- Filename Configurator Factory ---
function initializeFilenameConfigurator({ listEl, previewEl, storageKey, defaultConfig, extension }) {
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
    showStatusMessage('options_saved_message');
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

  return { load, setupDragAndDrop };
}


// --- Folder Tree Logic ---
function flattenFolders(folder) {
  folderMap.set(folder.folderid, folder);
  if (folder.contents) {
    folder.contents.forEach(child => flattenFolders(child));
  }
}

function buildPath(folderId) {
  if (folderId === 0) return '/';
  if (!folderMap.has(folderId)) return '/';
  let path = [];
  let current = folderMap.get(folderId);
  while (current && current.folderid !== 0) {
    path.unshift(current.name);
    current = folderMap.get(current.parentfolderid);
  }
  return '/' + path.join('/');
}

function buildFolderTree(folder) {
  const li = document.createElement('li');
  const isExpanded = folderCollapseState[folder.folderid] !== false;
  li.dataset.folderId = folder.folderid;
  if (!isExpanded) li.classList.add('collapsed');
  const hasChildren = folder.contents && folder.contents.length > 0;
  const itemDiv = document.createElement('div');
  itemDiv.className = 'folder-item';
  const toggleIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  toggleIcon.setAttribute('class', 'icon toggle-icon');
  toggleIcon.setAttribute('viewBox', '0 0 24 24');
  toggleIcon.innerHTML = `<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>`;
  if (hasChildren) {
    itemDiv.appendChild(toggleIcon);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'icon';
    itemDiv.appendChild(placeholder);
  }
  const folderIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  folderIcon.setAttribute('class', 'icon folder-icon');
  folderIcon.setAttribute('viewBox', '0 0 24 24');
  folderIcon.innerHTML = `<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>`;
  itemDiv.appendChild(folderIcon);
  const nameSpan = document.createElement('span');
  nameSpan.className = 'folder-name';
  nameSpan.textContent = folder.name === '/' ? 'pCloud' : folder.name;
  itemDiv.appendChild(nameSpan);
  li.appendChild(itemDiv);
  if (hasChildren) {
    const ul = document.createElement('ul');
    if (!isExpanded) ul.classList.add('hidden');
    folder.contents.forEach(child => ul.appendChild(buildFolderTree(child)));
    li.appendChild(ul);
  }
  return li;
}

async function renderFolderTree() {
  folderTreeContainer.textContent = chrome.i18n.getMessage('options_loading_folders');
  try {
    const authToken = await getAuthToken();
    if (!authToken) {
      folderTreeContainer.textContent = chrome.i18n.getMessage('options_login_to_load');
      return;
    }
    const client = new PCloudAPIClient(authToken);
    const folderData = await client.listAllFolders();
    folderMap.clear();
    flattenFolders(folderData.metadata);
    const { [DEFAULT_UPLOAD_FOLDER_ID_KEY]: currentFolderId = 0 } = await chrome.storage.sync.get(DEFAULT_UPLOAD_FOLDER_ID_KEY);
    folderTreeContainer.innerHTML = '';
    const tree = buildFolderTree(folderData.metadata);
    folderTreeContainer.appendChild(tree);
    const selectedLi = folderTreeContainer.querySelector(`li[data-folder-id="${currentFolderId}"]`);
    if (selectedLi) selectedLi.classList.add('selected');
    updateSelectedPathDisplay(buildPath(currentFolderId), currentFolderId);
  } catch (error) {
    console.error('Failed to load folder tree:', error);
    folderTreeContainer.textContent = chrome.i18n.getMessage('options_error_loading_folders');
    updateSelectedPathDisplay('Error', '');
  }
}

function updateSelectedPathDisplay(path, id) {
  selectedFolderPathDiv.textContent = path;
  if (IS_DEV_MODE) {
    devFolderIdSpan.textContent = `(id: ${id})`;
    devFolderIdSpan.classList.remove('hidden');
  } else {
    devFolderIdSpan.textContent = '';
    devFolderIdSpan.classList.add('hidden');
  }
}

async function handleTreeClick(e) {
  const itemDiv = e.target.closest('.folder-item');
  if (!itemDiv) return;
  const li = itemDiv.parentElement;
  const folderId = parseInt(li.dataset.folderId, 10);
  const target = e.target;
  if (target.closest('.toggle-icon')) {
    const ul = li.querySelector('ul');
    if (ul) {
      const isCollapsing = !li.classList.contains('collapsed');
      li.classList.toggle('collapsed');
      ul.classList.toggle('hidden');
      folderCollapseState[folderId] = !isCollapsing;
      await chrome.storage.local.set({ [FOLDER_STATE_KEY]: folderCollapseState });
    }
  } else {
    const path = buildPath(folderId);
    await chrome.storage.sync.set({
      [DEFAULT_UPLOAD_FOLDER_ID_KEY]: folderId,
      [DEFAULT_UPLOAD_FOLDER_PATH_KEY]: path
    });
    document.querySelectorAll('.folder-tree li.selected').forEach(el => el.classList.remove('selected'));
    li.classList.add('selected');
    updateSelectedPathDisplay(buildPath(folderId), folderId);
    showStatusMessage('options_saved_message');
  }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize MDC components
  themeSelect = new mdc.select.MDCSelect(themeSelectElement);
  snackbar = new mdc.snackbar.MDCSnackbar(snackbarElement);

  localizeHtml();
  await loadAndApplyTheme();

  // Initialize Image Filename Configurator
  const imageConfigurator = initializeFilenameConfigurator({
    listEl: imageFilenamePartsList,
    previewEl: imageFilenamePreview,
    storageKey: FILENAME_CONFIG_KEY,
    defaultConfig: defaultImageFilenameConfig,
    extension: '.jpg'
  });
  await imageConfigurator.load();
  imageConfigurator.setupDragAndDrop();

  // Initialize Text Filename Configurator
  const textConfigurator = initializeFilenameConfigurator({
    listEl: textFilenamePartsList,
    previewEl: textFilenamePreview,
    storageKey: TEXT_FILENAME_CONFIG_KEY,
    defaultConfig: defaultTextFilenameConfig,
    extension: '.md'
  });
  await textConfigurator.load();
  textConfigurator.setupDragAndDrop();

  // Initialize Text Metadata Checkbox
  const { [TEXT_INCLUDE_METADATA_KEY]: savedTextMetadata = false } = await chrome.storage.sync.get(TEXT_INCLUDE_METADATA_KEY);
  textMetadataCheckbox.checked = savedTextMetadata;

  textMetadataCheckbox.addEventListener('change', async () => {
    await chrome.storage.sync.set({ [TEXT_INCLUDE_METADATA_KEY]: textMetadataCheckbox.checked });
    showStatusMessage('options_saved_message');
  });

  // Initialize Document Filename Configurator
  const docConfigurator = initializeFilenameConfigurator({
    listEl: docFilenamePartsList,
    previewEl: docFilenamePreview,
    storageKey: DOC_FILENAME_CONFIG_KEY,
    defaultConfig: defaultDocFilenameConfig,
    extension: '.md' // Initial extension, will update based on format
  });
  await docConfigurator.load();
  docConfigurator.setupDragAndDrop();

  // Initialize Document Format Select
  docFormatSelect = new mdc.select.MDCSelect(docFormatSelectElement);
  const { [DOC_FORMAT_KEY]: savedFormat = 'md', [DOC_INCLUDE_METADATA_KEY]: savedMetadata = false } = await chrome.storage.sync.get([DOC_FORMAT_KEY, DOC_INCLUDE_METADATA_KEY]);

  docFormatSelect.value = savedFormat;
  docMetadataCheckbox.checked = savedMetadata;

  // Helper to update metadata visibility and preview extension
  const updateDocUI = () => {
    const format = docFormatSelect.value;
    if (format === 'md') {
      docMetadataContainer.style.display = 'block';
      // Hacky way to update extension in preview: reload configurator or just update text
      // Since initializeFilenameConfigurator uses closure for extension, we might need to re-init or expose updateExtension.
      // For simplicity, let's just reload the configurator with new extension.
      // Actually, simpler: just replace the extension in the preview text manually here if we want immediate feedback.
      // But let's re-init for correctness if user changes format.
      // Optimization: We can just update the preview text content.
      const currentPreview = docFilenamePreview.textContent;
      docFilenamePreview.textContent = currentPreview.replace(/\.[^.]+$/, '.' + format);
    } else {
      docMetadataContainer.style.display = 'none';
      const extMap = { 'pdf': 'pdf', 'doc': 'docx' };
      const currentPreview = docFilenamePreview.textContent;
      docFilenamePreview.textContent = currentPreview.replace(/\.[^.]+$/, '.' + (extMap[format] || format));
    }
  };

  updateDocUI();

  docFormatSelect.listen('MDCSelect:change', async () => {
    const format = docFormatSelect.value;
    await chrome.storage.sync.set({ [DOC_FORMAT_KEY]: format });
    updateDocUI();
    showStatusMessage('options_saved_message');
  });

  docMetadataCheckbox.addEventListener('change', async () => {
    await chrome.storage.sync.set({ [DOC_INCLUDE_METADATA_KEY]: docMetadataCheckbox.checked });
    showStatusMessage('options_saved_message');
  });

  document.title = chrome.i18n.getMessage('extensionName');
  const state = await chrome.storage.local.get(FOLDER_STATE_KEY);
  folderCollapseState = state[FOLDER_STATE_KEY] || {};
  await renderFolderTree();

  // Event Listeners
  folderTreeContainer.addEventListener('click', handleTreeClick);
  themeSelect.listen('MDCSelect:change', async () => {
    const selectedTheme = themeSelect.value;
    await chrome.storage.sync.set({ [THEME_KEY]: selectedTheme });
    applyTheme(selectedTheme);
  });

  // Initialize Domain Rules Manager
  const domainRulesManager = new DomainRulesManager();
  await domainRulesManager.init();

  // Initialize Payment Manager
  const paymentManager = new PaymentManager();
  await paymentManager.init();
});

// --- Domain Rules Manager ---
const DOMAIN_RULES_KEY = 'domain_upload_rules';

class DomainRulesManager {
  constructor() {
    this.rules = [];
    this.listEl = document.getElementById('domain-rules-list');
    this.addBtn = document.getElementById('add-rule-btn');
    this.helpBtn = document.getElementById('domain-rules-help-btn');
    this.testToggleBtn = document.getElementById('test-playground-toggle-btn');
    this.testPlayground = document.getElementById('test-playground');
    this.testInput = document.getElementById('test-url-input');
    this.testResult = document.getElementById('test-result');

    // Dialogs
    this.ruleEditorDialog = new mdc.dialog.MDCDialog(document.getElementById('rule-editor-dialog'));
    this.folderPickerDialog = new mdc.dialog.MDCDialog(document.getElementById('folder-picker-dialog'));
    this.helpDialog = new mdc.dialog.MDCDialog(document.getElementById('help-dialog'));
    this.deleteConfirmDialog = null; // Created on demand

    // Editor Elements
    this.editorDomainInput = document.getElementById('rule-domain-input');
    this.editorPathInput = document.getElementById('rule-path-input');
    this.editorFolderIdInput = document.getElementById('rule-folder-id-input');
    this.editorFolderPickerBtn = document.getElementById('rule-folder-picker-btn');
    this.editorTitle = document.getElementById('rule-editor-title');

    // Folder Picker Elements
    this.pickerTreeContainer = document.getElementById('picker-folder-tree');
    this.newFolderNameInput = document.getElementById('new-folder-name-input');
    this.createFolderBtn = document.getElementById('create-folder-btn');
    this.pickerSelectBtn = document.querySelector('#folder-picker-dialog [data-mdc-dialog-action="select"]');
    this.pickerSelectedFolderId = null;
    this.pickerSelectedFolderPath = null;

    this.editingRuleId = null;

    // Initialize MDC Text Fields
    this.domainInputMDC = new mdc.textField.MDCTextField(this.editorDomainInput.closest('.mdc-text-field'));
    this.pathInputMDC = new mdc.textField.MDCTextField(this.editorPathInput.closest('.mdc-text-field'));
    this.newFolderInputMDC = new mdc.textField.MDCTextField(this.newFolderNameInput.closest('.mdc-text-field'));
    this.testInputMDC = new mdc.textField.MDCTextField(this.testInput.closest('.mdc-text-field'));

    this.bindEvents();
  }

  async init() {
    const { [DOMAIN_RULES_KEY]: savedRules = [] } = await chrome.storage.sync.get(DOMAIN_RULES_KEY);
    this.rules = savedRules;
    this.render();
  }

  bindEvents() {
    this.addBtn.addEventListener('click', () => this.openEditor());
    this.helpBtn.addEventListener('click', () => this.helpDialog.open());
    this.testToggleBtn.addEventListener('click', () => {
      this.testPlayground.classList.toggle('hidden');
    });
    this.testInput.addEventListener('input', () => this.runTest());

    this.ruleEditorDialog.listen('MDCDialog:closing', async (event) => {
      if (event.detail.action === 'save') {
        await this.saveRule();
      }
    });

    this.editorFolderPickerBtn.addEventListener('click', () => this.openFolderPicker());

    // Folder Picker Events
    this.pickerTreeContainer.addEventListener('click', (e) => this.handlePickerTreeClick(e));
    this.createFolderBtn.addEventListener('click', () => this.createFolder());
    this.folderPickerDialog.listen('MDCDialog:closing', (event) => {
      if (event.detail.action === 'select') {
        if (this.pickerSelectedFolderId !== null) {
          this.pathInputMDC.value = this.pickerSelectedFolderPath;
          this.editorFolderIdInput.value = this.pickerSelectedFolderId;
        }
      }
    });

    // Drag and Drop for Rules List
    this.setupDragAndDrop();
  }

  render() {
    this.listEl.innerHTML = '';
    this.rules.forEach((rule, index) => {
      const tr = document.createElement('tr');
      tr.className = 'mdc-data-table__row domain-rule-row';
      tr.draggable = true;
      tr.dataset.id = rule.id;
      tr.dataset.index = index;

      tr.innerHTML = `
        <td class="mdc-data-table__cell">
          <button class="mdc-switch ${rule.enabled ? 'mdc-switch--selected' : 'mdc-switch--unselected'}" type="button" role="switch" aria-checked="${rule.enabled}">
            <div class="mdc-switch__track"></div>
            <div class="mdc-switch__handle-track">
              <div class="mdc-switch__handle">
                <div class="mdc-switch__shadow">
                  <div class="mdc-elevation-overlay"></div>
                </div>
                <div class="mdc-switch__ripple"></div>
                <div class="mdc-switch__icons">
                  <svg class="mdc-switch__icon mdc-switch__icon--on" viewBox="0 0 24 24">
                    <path d="M19.69,5.23L8.96,15.96l-4.23-4.23L2.96,13.5l6,6L21.46,7L19.69,5.23z" />
                  </svg>
                  <svg class="mdc-switch__icon mdc-switch__icon--off" viewBox="0 0 24 24">
                    <path d="M20 13H4v-2h16v2z" />
                  </svg>
                </div>
              </div>
            </div>
          </button>
        </td>
        <td class="mdc-data-table__cell">${rule.domainPattern}</td>
        <td class="mdc-data-table__cell">${rule.targetPath}</td>
        <td class="mdc-data-table__cell rule-actions">
          <button class="mdc-icon-button material-icons edit-rule-btn" data-id="${rule.id}">edit</button>
          <button class="mdc-icon-button material-icons delete-rule-btn" data-id="${rule.id}">delete</button>
        </td>
      `;

      this.listEl.appendChild(tr);

      // Initialize MDC Switch
      const switchEl = tr.querySelector('.mdc-switch');
      const switchControl = new mdc.switchControl.MDCSwitch(switchEl);

      // Listen for changes
      // MDC Switch doesn't always emit a standard change event on the button element directly in all versions?
      // But usually it does, or we can listen to 'click' and check state.
      // Best practice: use the component's listen method if possible, or just click.
      // Let's try standard click which toggles it, then we read state.
      switchEl.addEventListener('click', () => {
        // The component handles the visual toggle. We just need to update our model.
        // We need to wait for the state to update? 
        // Actually, we can just toggle our model based on the *new* state.
        // But `switchControl.selected` should be the new state after click.
        this.toggleRule(rule.id, !rule.enabled);
      });

      tr.querySelector('.edit-rule-btn').addEventListener('click', () => this.openEditor(rule.id));
      tr.querySelector('.delete-rule-btn').addEventListener('click', () => this.confirmDelete(rule.id));
    });
  }

  async saveRules() {
    await chrome.storage.sync.set({ [DOMAIN_RULES_KEY]: this.rules });
    this.render();
    showStatusMessage('options_saved_message');
    this.runTest(); // Re-run test if open
  }

  async toggleRule(id, enabled) {
    const rule = this.rules.find(r => r.id === id);
    if (rule) {
      rule.enabled = enabled;
      await this.saveRules();
    }
  }

  openEditor(id = null) {
    this.editingRuleId = id;
    if (id) {
      const rule = this.rules.find(r => r.id === id);
      this.domainInputMDC.value = rule.domainPattern;
      this.pathInputMDC.value = rule.targetPath;
      this.editorFolderIdInput.value = rule.targetFolderId || 0; // Fallback
      this.editorTitle.textContent = chrome.i18n.getMessage('options_domain_rules_dialog_title_edit');
    } else {
      this.domainInputMDC.value = '';
      this.pathInputMDC.value = '';
      this.editorFolderIdInput.value = '';
      this.editorTitle.textContent = chrome.i18n.getMessage('options_domain_rules_dialog_title_add');
    }
    // Re-localize static elements in dialog to be safe
    localizeHtml();
    this.ruleEditorDialog.open();
  }

  async saveRule() {
    const domain = this.editorDomainInput.value.trim();
    const path = this.editorPathInput.value.trim();
    const folderId = parseInt(this.editorFolderIdInput.value, 10) || 0;

    if (!domain || !path) return;

    if (this.editingRuleId) {
      const rule = this.rules.find(r => r.id === this.editingRuleId);
      rule.domainPattern = domain;
      rule.targetPath = path;
      rule.targetFolderId = folderId;
    } else {
      this.rules.push({
        id: Date.now().toString(),
        enabled: true,
        domainPattern: domain,
        targetPath: path,
        targetFolderId: folderId
      });
    }
    await this.saveRules();
  }

  confirmDelete(id) {
    if (confirm(chrome.i18n.getMessage('options_domain_rules_confirm_delete'))) {
      this.rules = this.rules.filter(r => r.id !== id);
      this.saveRules();
    }
  }

  runTest() {
    const url = this.testInput.value.trim();
    if (!url) {
      this.testResult.textContent = '';
      return;
    }

    const matchedRule = this.rules.find(rule => {
      if (!rule.enabled) return false;
      // Simple wildcard matching: * -> .*
      const regexPattern = '^' + rule.domainPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      try {
        // Extract domain from URL
        let domain;
        try {
          domain = new URL(url).hostname;
        } catch (e) {
          domain = url; // Treat as raw domain if not a full URL
        }
        return new RegExp(regexPattern).test(domain);
      } catch (e) {
        return false;
      }
    });

    this.testResult.className = 'test-result'; // Reset classes
    if (matchedRule) {
      this.testResult.textContent = chrome.i18n.getMessage('options_domain_rules_test_result_match', [matchedRule.domainPattern]) + ` -> ${matchedRule.targetPath}`;
      this.testResult.classList.add('text-primary');
    } else {
      this.testResult.textContent = chrome.i18n.getMessage('options_domain_rules_test_result_no_match');
      this.testResult.classList.add('text-error');
    }
  }

  setupDragAndDrop() {
    let draggedItem = null;
    this.listEl.addEventListener('dragstart', e => {
      draggedItem = e.target.closest('tr');
      if (draggedItem) {
        setTimeout(() => draggedItem.classList.add('dragging'), 0);
      }
    });
    this.listEl.addEventListener('dragend', e => {
      if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
        this.updateOrderFromDom();
      }
    });
    this.listEl.addEventListener('dragover', e => {
      e.preventDefault();
      const afterElement = this.getDragAfterElement(this.listEl, e.clientY);
      const currentElement = this.listEl.querySelector('.dragging');
      if (currentElement) {
        if (afterElement == null) {
          this.listEl.appendChild(currentElement);
        } else {
          this.listEl.insertBefore(currentElement, afterElement);
        }
      }
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.domain-rule-row:not(.dragging)')];
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

  async updateOrderFromDom() {
    const newOrder = [];
    this.listEl.querySelectorAll('.domain-rule-row').forEach(row => {
      const id = row.dataset.id;
      const rule = this.rules.find(r => r.id === id);
      if (rule) newOrder.push(rule);
    });
    this.rules = newOrder;
    await this.saveRules();
  }

  // --- Folder Picker Logic ---
  async openFolderPicker() {
    this.pickerTreeContainer.innerHTML = chrome.i18n.getMessage('options_loading_folders');
    this.pickerSelectedFolderId = null;
    this.pickerSelectedFolderPath = null;
    this.pickerSelectBtn.disabled = true;
    this.folderPickerDialog.open();

    try {
      const authToken = await getAuthToken();
      if (!authToken) throw new Error('Not authenticated');
      this.pCloudClient = new PCloudAPIClient(authToken);

      // Initial load: root folder
      const rootData = await this.pCloudClient.listFolder(0);
      this.pickerTreeContainer.innerHTML = '';
      this.pickerTreeContainer.appendChild(this.buildPickerTree(rootData.metadata));
    } catch (error) {
      console.error('Picker Error:', error);
      this.pickerTreeContainer.textContent = chrome.i18n.getMessage('options_error_loading_folders');
    }
  }

  buildPickerTree(folder) {
    const li = document.createElement('li');
    li.dataset.folderId = folder.folderid;
    li.dataset.name = folder.name;
    li.dataset.loaded = 'false'; // For lazy loading
    li.classList.add('collapsed');

    const itemDiv = document.createElement('div');
    itemDiv.className = 'folder-item';

    // Toggle Icon
    const toggleIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    toggleIcon.setAttribute('class', 'icon toggle-icon');
    toggleIcon.setAttribute('viewBox', '0 0 24 24');
    toggleIcon.innerHTML = `<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>`;
    itemDiv.appendChild(toggleIcon);

    // Folder Icon
    const folderIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    folderIcon.setAttribute('class', 'icon folder-icon');
    folderIcon.setAttribute('viewBox', '0 0 24 24');
    folderIcon.innerHTML = `<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>`;
    itemDiv.appendChild(folderIcon);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'folder-name';
    nameSpan.textContent = folder.name === '/' ? 'pCloud' : folder.name;
    itemDiv.appendChild(nameSpan);

    li.appendChild(itemDiv);

    // Container for children
    const ul = document.createElement('ul');
    ul.classList.add('hidden');
    li.appendChild(ul);

    // If initial data has contents (e.g. root), populate it
    if (folder.contents) {
      folder.contents.filter(f => f.isfolder).forEach(child => {
        ul.appendChild(this.buildPickerTree(child));
      });
      li.dataset.loaded = 'true';
    }

    return li;
  }

  async handlePickerTreeClick(e) {
    const itemDiv = e.target.closest('.folder-item');
    if (!itemDiv) return;
    const li = itemDiv.parentElement;
    const folderId = parseInt(li.dataset.folderId, 10);
    const folderName = li.dataset.name;

    // Selection Logic
    document.querySelectorAll('#picker-folder-tree li.selected').forEach(el => el.classList.remove('selected'));
    li.classList.add('selected');
    this.pickerSelectedFolderId = folderId;
    // Note: Building full path in lazy load is tricky without full tree. 
    // For now, we might just store the name or fetch path. 
    // A simple workaround is to assume user knows context or fetch path info.
    // Let's try to build path from DOM structure if possible, or just use name.
    this.pickerSelectedFolderPath = this.buildPathFromDom(li);
    this.pickerSelectBtn.disabled = false;

    // Expansion Logic
    if (e.target.closest('.toggle-icon')) {
      const ul = li.querySelector('ul');
      const isCollapsed = li.classList.contains('collapsed');

      if (isCollapsed) {
        li.classList.remove('collapsed');
        ul.classList.remove('hidden');

        // Lazy Load if needed
        if (li.dataset.loaded === 'false') {
          try {
            // Show loading indicator?
            const data = await this.pCloudClient.listFolder(folderId);
            ul.innerHTML = ''; // Clear placeholders if any
            if (data.metadata.contents) {
              data.metadata.contents.filter(f => f.isfolder).forEach(child => {
                ul.appendChild(this.buildPickerTree(child));
              });
            }
            li.dataset.loaded = 'true';
          } catch (err) {
            console.error('Lazy load failed', err);
          }
        }
      } else {
        li.classList.add('collapsed');
        ul.classList.add('hidden');
      }
    }
  }

  buildPathFromDom(li) {
    let path = [];
    let current = li;
    while (current && current.tagName === 'LI') {
      let name = current.dataset.name;
      if (name === '/') name = ''; // Root
      path.unshift(name);
      current = current.parentElement.closest('li');
    }
    return '/' + path.filter(p => p).join('/');
  }

  async createFolder() {
    const name = this.newFolderNameInput.value.trim();
    if (!name || this.pickerSelectedFolderId === null) return;

    try {
      const newFolder = await this.pCloudClient.createFolder(this.pickerSelectedFolderId, name);
      // Refresh the selected folder's children
      const selectedLi = this.pickerTreeContainer.querySelector(`li[data-folder-id="${this.pickerSelectedFolderId}"]`);
      if (selectedLi) {
        // Force reload
        selectedLi.dataset.loaded = 'false';
        selectedLi.classList.add('collapsed'); // Reset state to force expand click to reload
        // Simulate click to expand and reload
        const toggleIcon = selectedLi.querySelector('.toggle-icon');
        toggleIcon.dispatchEvent(new Event('click', { bubbles: true }));
      }
      this.newFolderNameInput.value = '';
      showStatusMessage('options_saved_message'); // Reuse saved message for success
    } catch (error) {
      console.error('Create folder failed', error);
      alert('Failed to create folder: ' + error.message);
    }
  }
}

// --- Payment Manager ---
// Sandbox Client ID (Same for both tiers in dev, but logic supports different ones)
const PAYPAL_CLIENT_ID = 'ASIxhJYAlMUVAvBcQGtXSP5fsH9caU6n6zfWneS36yXTPIEajc99yzCwHA2VqbinPgikHvfJ0xLkv0Sv';

class PaymentManager {
  constructor() {
    this.premiumCard = document.getElementById('premium-card');
    this.premiumStatusBadge = document.getElementById('premium-status-badge');
    this.promoContent = document.getElementById('premium-promo-content');
    this.activeContent = document.getElementById('premium-active-content');
    this.restoreBtn = document.getElementById('restore-purchase-btn');
    this.upgradePcloudBtn = document.getElementById('upgrade-pcloud-btn');
    this.upgradeMasterBtn = document.getElementById('upgrade-master-btn');
    this.currentPlanNameEl = document.getElementById('current-plan-name');
    this.resultMessage = document.getElementById('result-message');

    this.tierRadios = document.querySelectorAll('input[name="pricing-tier"]');
    this.selectedTier = 'hf4pcloud'; // Default
    this.currentUserEmail = null;
  }

  async init() {
    await licenseManager.init();

    // Fetch user email for binding
    try {
      const authToken = await getAuthToken();
      if (authToken) {
        const client = new PCloudAPIClient(authToken);
        const userInfo = await client.getUserInfo();
        this.currentUserEmail = userInfo.email;
        console.log('User email fetched:', this.currentUserEmail);
      }
    } catch (e) {
      console.error('Failed to fetch user info:', e);
    }

    this.updateUI();

    licenseManager.addListener(() => this.updateUI());

    // Setup button listeners
    this.restoreBtn.addEventListener('click', () => this.restorePurchase());
    this.upgradePcloudBtn.addEventListener('click', () => this.openPaymentPage('hf4pcloud'));
    this.upgradeMasterBtn.addEventListener('click', () => this.openPaymentPage('hf4master'));

    // Listen for tier changes to show appropriate button
    this.tierRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.selectedTier = e.target.value;
        this.updateUpgradeButtons();
      });
    });

    this.updateUpgradeButtons();

    // Check for payment redirect parameters
    await this.checkPaymentRedirect();
  }

  async checkPaymentRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const licenseKey = urlParams.get('license_key') || urlParams.get('license');

    if (status === 'success' && licenseKey) {
      console.log('[PaymentManager] Payment successful, checking license...');

      if (!this.currentUserEmail) {
        console.warn('[PaymentManager] No user email found during redirect handling.');
        // If we don't have the email, we can't verify against the backend properly 
        // unless we prompt the user or retry. For now, we abort.
        showStatusMessage('options_error_loading_folders'); // Reusing generic error or add new one
        return;
      }

      try {
        // Verify and restore the license from the backend
        const license = await licenseManager.restorePurchase(this.currentUserEmail);

        if (license) {
          showStatusMessage('options_payment_success');
          // Clean up URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } else {
          console.error('[PaymentManager] License verification failed after redirect.');
          showStatusMessage('options_payment_failed');
        }
      } catch (error) {
        console.error('[PaymentManager] Failed to verify license:', error);
        showStatusMessage('options_payment_failed');
      }
    } else if (status === 'cancel') {
      showStatusMessage('options_payment_failed');
    }
  }

  updateUI() {
    const isPremium = licenseManager.isPremium();
    const license = licenseManager.getLicenseInfo();

    if (isPremium) {
      this.premiumCard.classList.add('active');
      this.premiumStatusBadge.classList.remove('hidden');
      this.promoContent.classList.add('hidden');
      this.activeContent.classList.remove('hidden');

      if (license) {
        const planNameKey = license.productType === 'hf4master' ? 'options_tier_master_name' : 'options_tier_pcloud_name';
        this.currentPlanNameEl.textContent = chrome.i18n.getMessage(planNameKey);
      }
    } else {
      this.premiumCard.classList.remove('active');
      this.premiumStatusBadge.classList.add('hidden');
      this.promoContent.classList.remove('hidden');
      this.activeContent.classList.add('hidden');
    }
  }

  updateUpgradeButtons() {
    // Show/hide buttons based on selected tier
    if (this.selectedTier === 'hf4pcloud') {
      this.upgradePcloudBtn.style.display = 'inline-flex';
      this.upgradeMasterBtn.style.display = 'none';
    } else {
      this.upgradePcloudBtn.style.display = 'none';
      this.upgradeMasterBtn.style.display = 'inline-flex';
    }
  }

  openPaymentPage(tier) {
    if (!this.currentUserEmail) {
      showStatusMessage('options_error_loading_folders');
      console.error('[PaymentManager] No user email found');
      return;
    }

    // Mock URL for development
    // TODO: Replace with actual payment page URL when ready
    const PAYMENT_URL = 'https://paypal-payment.taislife.work';
    const redirectUrl = chrome.runtime.getURL("src/options/options.html");
    const tierNames = {
      'hf4pcloud': 'HyperFetch for pCloud ($1.99)',
      'hf4master': 'HyperFetch Master ($5.00)'
    };

    console.log(`[PaymentManager] Opening payment page for ${tierNames[tier]}`);
    console.log(`[PaymentManager] Email: ${this.currentUserEmail}`);
    console.log(`[PaymentManager] Tier: ${tier}`);

    // In production, this will be:
    const paymentUrl = `${PAYMENT_URL}?tier=${tier}&email=${encodeURIComponent(this.currentUserEmail)}&client_id=${PAYPAL_CLIENT_ID}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    chrome.tabs.create({
      url: paymentUrl
    }, (tab) => {
      console.log(`[PaymentManager] Opened tab ${tab.id}`);
      this.resultMessage.textContent = chrome.i18n.getMessage('options_payment_page_opening');
    });
  }

  async restorePurchase() {
    if (!this.currentUserEmail) {
      alert(chrome.i18n.getMessage('options_error_loading_folders')); // Fallback
      return;
    }

    try {
      const license = await licenseManager.restorePurchase(this.currentUserEmail);
      if (license) {
        await licenseManager.saveLicense(license);
        showStatusMessage('options_restore_success');
      } else {
        showStatusMessage('options_restore_failed');
      }
    } catch (e) {
      console.error('Restore failed', e);
      showStatusMessage('options_restore_failed');
    }
  }
}