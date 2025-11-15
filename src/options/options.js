// src/options/options.js

import { getAuthToken } from '../core/auth.js';
import PCloudAPIClient from '../core/pcloud-api.js';

const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';
const FOLDER_STATE_KEY = 'folder_collapse_state';
const THEME_KEY = 'selected_theme';
const IS_DEV_MODE = !('update_url' in chrome.runtime.getManifest());

// --- DOM Elements ---
const folderTreeContainer = document.getElementById('folder-tree-container');
const selectedFolderPathDiv = document.getElementById('selected-folder-path');
const devFolderIdSpan = document.getElementById('dev-folder-id');
const themeSelectElement = document.getElementById('theme-select');
const snackbarElement = document.getElementById('app-snackbar');

// --- State ---
let folderCollapseState = {};
let folderMap = new Map();
let themeSelect;
let snackbar;

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
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = chrome.i18n.getMessage(el.dataset.i18nTitle);
  });
}

function showStatusMessage(messageKey) {
  if (!snackbar) return;
  const message = chrome.i18n.getMessage(messageKey);
  snackbar.labelText = message;
  snackbar.open();
}

// --- Folder Tree Logic ---
function flattenFolders(folder) {
  folderMap.set(folder.folderid, folder);
  if (folder.contents) {
    folder.contents.forEach(child => flattenFolders(child));
  }
}

function buildPath(folderId) {
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
  if (!isExpanded) {
      li.classList.add('collapsed');
  }

  const hasChildren = folder.contents && folder.contents.length > 0;

  const itemDiv = document.createElement('div');
  itemDiv.className = 'folder-item';

  // Toggle Icon (Chevron)
  const toggleIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  toggleIcon.setAttribute('class', 'icon toggle-icon');
  toggleIcon.setAttribute('viewBox', '0 0 24 24');
  toggleIcon.innerHTML = `<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>`;
  if (hasChildren) {
      itemDiv.appendChild(toggleIcon);
  } else {
      // Add a placeholder to maintain alignment
      const placeholder = document.createElement('span');
      placeholder.className = 'icon';
      itemDiv.appendChild(placeholder);
  }

  // Folder Icon
  const folderIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  folderIcon.setAttribute('class', 'icon folder-icon');
  folderIcon.setAttribute('viewBox', '0 0 24 24');
  folderIcon.innerHTML = `<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>`;
  itemDiv.appendChild(folderIcon);

  // Folder Name
  const nameSpan = document.createElement('span');
  nameSpan.className = 'folder-name';
  nameSpan.textContent = folder.name === '/' ? 'pCloud' : folder.name;
  itemDiv.appendChild(nameSpan);
  li.appendChild(itemDiv);

  if (hasChildren) {
    const ul = document.createElement('ul');
    if (!isExpanded) {
      ul.classList.add('hidden');
    }
    folder.contents.forEach(child => {
      ul.appendChild(buildFolderTree(child));
    });
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
    if (selectedLi) {
      selectedLi.classList.add('selected');
    }
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

  // Click on toggle icon
  if (target.closest('.toggle-icon')) {
    const ul = li.querySelector('ul');
    if (ul) {
      const isCollapsing = !li.classList.contains('collapsed');
      li.classList.toggle('collapsed');
      ul.classList.toggle('hidden');
      folderCollapseState[folderId] = !isCollapsing;
      await chrome.storage.local.set({ [FOLDER_STATE_KEY]: folderCollapseState });
    }
  } else { // Click on folder name or item body
    await chrome.storage.sync.set({ [DEFAULT_UPLOAD_FOLDER_ID_KEY]: folderId });
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