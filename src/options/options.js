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
const statusMessage = document.getElementById('status-message');
const themeSelectElement = document.getElementById('theme-select');

// --- State ---
let folderCollapseState = {};
let folderMap = new Map();
let themeSelect;

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
      // For MDC list items, the text might be in a nested span
      const textSpan = el.querySelector('.mdc-list-item__text');
      if (textSpan) {
          textSpan.textContent = message;
      } else {
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

function showStatusMessage(messageKey, type = 'success') {
  statusMessage.textContent = chrome.i18n.getMessage(messageKey);
  statusMessage.className = `success-message ${type === 'error' ? 'error-message' : ''}`;
  statusMessage.classList.remove('hidden');
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 3000);
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

function buildFolderTree(folder, currentFolderId) {
  const li = document.createElement('li');
  const isExpanded = folderCollapseState[folder.folderid] !== false;
  li.dataset.folderId = folder.folderid;

  const hasChildren = folder.contents && folder.contents.length > 0;
  if (hasChildren) {
    const toggleIcon = document.createElement('img');
    toggleIcon.src = isExpanded ? '../assets/icons/arrow-down.svg' : '../assets/icons/arrow-right.svg';
    toggleIcon.className = 'toggle-icon';
    li.appendChild(toggleIcon);
  }

  const nameSpan = document.createElement('span');
  nameSpan.className = 'folder-name';
  nameSpan.textContent = folder.name;
  li.appendChild(nameSpan);

  if (hasChildren) {
    const ul = document.createElement('ul');
    if (!isExpanded) {
      ul.classList.add('hidden');
    }
    folder.contents.forEach(child => {
      ul.appendChild(buildFolderTree(child, currentFolderId));
    });
    li.appendChild(ul);
  }

  return li;
}

async function renderFolderTree() {
  folderTreeContainer.textContent = 'Loading folders...';
  try {
    const authToken = await getAuthToken();
    if (!authToken) {
      folderTreeContainer.textContent = 'Please log in via the extension popup to load folders.';
      return;
    }
    const client = new PCloudAPIClient(authToken);
    const folderData = await client.listAllFolders();
    
    folderMap.clear();
    flattenFolders(folderData.metadata);

    const { [DEFAULT_UPLOAD_FOLDER_ID_KEY]: currentFolderId = 0 } = await chrome.storage.sync.get(DEFAULT_UPLOAD_FOLDER_ID_KEY);

    folderTreeContainer.innerHTML = '';
    const tree = buildFolderTree(folderData.metadata, currentFolderId);
    folderTreeContainer.appendChild(tree);

    const selectedLi = folderTreeContainer.querySelector(`li[data-folder-id="${currentFolderId}"]`);
    if (selectedLi) {
      selectedLi.classList.add('selected');
    }
    updateSelectedPathDisplay(buildPath(currentFolderId), currentFolderId);

  } catch (error) {
    console.error('Failed to load folder tree:', error);
    folderTreeContainer.textContent = 'Error loading folders.';
    updateSelectedPathDisplay('Error', '');
  }
}

function updateSelectedPathDisplay(path, id) {
  selectedFolderPathDiv.textContent = path;
  if (IS_DEV_MODE) {
    devFolderIdSpan.textContent = `(folder id: ${id})`;
    devFolderIdSpan.classList.remove('hidden');
  } else {
    devFolderIdSpan.textContent = '';
    devFolderIdSpan.classList.add('hidden');
  }
}

async function handleTreeClick(e) {
  const li = e.target.closest('li');
  if (!li) return;

  const folderId = parseInt(li.dataset.folderId, 10);
  const target = e.target;

  if (target.classList.contains('toggle-icon')) {
    const ul = li.querySelector('ul');
    if (ul) {
      const isHidden = ul.classList.toggle('hidden');
      folderCollapseState[folderId] = !isHidden;
      await chrome.storage.local.set({ [FOLDER_STATE_KEY]: folderCollapseState });
      target.src = isHidden ? '../assets/icons/arrow-right.svg' : '../assets/icons/arrow-down.svg';
    }
  } else if (target.classList.contains('folder-name') || target.tagName === 'LI') {
    await chrome.storage.sync.set({ [DEFAULT_UPLOAD_FOLDER_ID_KEY]: folderId });
    document.querySelectorAll('.folder-tree li.selected').forEach(el => el.classList.remove('selected'));
    li.classList.add('selected');
    updateSelectedPathDisplay(buildPath(folderId), folderId);
    showStatusMessage('options_saved_message', 'success');
  }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize MDC components
  themeSelect = new mdc.select.MDCSelect(themeSelectElement);

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