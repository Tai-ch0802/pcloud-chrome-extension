import { getAuthToken } from '../core/auth.js';
import PCloudAPIClient from '../core/pcloud-api.js';

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
      } else if (el.matches('h1, h2, p, span, label')) {
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

  document.title = chrome.i18n.getMessage('options_title');
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
});