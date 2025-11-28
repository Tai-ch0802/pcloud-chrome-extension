import { getAuthToken } from '../../../core/auth.js';
import PCloudAPIClient from '../../../core/pcloud-api.js';

const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';
const DEFAULT_UPLOAD_FOLDER_PATH_KEY = 'default_upload_folder_path';
const FOLDER_STATE_KEY = 'folder_collapse_state';
const IS_DEV_MODE = !('update_url' in chrome.runtime.getManifest());

export default class UploadsSection {
    constructor() {
        this.element = null;
        this.folderTreeContainer = null;
        this.selectedFolderPathDiv = null;
        this.devFolderIdSpan = null;
        this.folderCollapseState = {};
        this.folderMap = new Map();
    }

    async render() {
        const response = await fetch(chrome.runtime.getURL('src/options/sections/uploads/template.html'));
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        this.element = doc.body.firstElementChild;
        return this.element;
    }

    async init() {
        this.folderTreeContainer = this.element.querySelector('#folder-tree-container');
        this.selectedFolderPathDiv = this.element.querySelector('#selected-folder-path');
        this.devFolderIdSpan = this.element.querySelector('#dev-folder-id');

        const state = await chrome.storage.local.get(FOLDER_STATE_KEY);
        this.folderCollapseState = state[FOLDER_STATE_KEY] || {};

        this.folderTreeContainer.addEventListener('click', (e) => this.handleTreeClick(e));

        await this.renderFolderTree();
    }

    flattenFolders(folder) {
        this.folderMap.set(folder.folderid, folder);
        if (folder.contents) {
            folder.contents.forEach(child => this.flattenFolders(child));
        }
    }

    buildPath(folderId) {
        if (folderId === 0) return '/';
        if (!this.folderMap.has(folderId)) return '/';
        let path = [];
        let current = this.folderMap.get(folderId);
        while (current && current.folderid !== 0) {
            path.unshift(current.name);
            current = this.folderMap.get(current.parentfolderid);
        }
        return '/' + path.join('/');
    }

    buildFolderTree(folder) {
        const li = document.createElement('li');
        const isExpanded = this.folderCollapseState[folder.folderid] !== false;
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
            folder.contents.forEach(child => ul.appendChild(this.buildFolderTree(child)));
            li.appendChild(ul);
        }
        return li;
    }

    async renderFolderTree() {
        this.folderTreeContainer.textContent = chrome.i18n.getMessage('options_loading_folders');
        try {
            const authToken = await getAuthToken();
            if (!authToken) {
                this.folderTreeContainer.textContent = chrome.i18n.getMessage('options_login_to_load');
                return;
            }
            const client = new PCloudAPIClient(authToken);
            const folderData = await client.listAllFolders();
            this.folderMap.clear();
            this.flattenFolders(folderData.metadata);
            const { [DEFAULT_UPLOAD_FOLDER_ID_KEY]: currentFolderId = 0 } = await chrome.storage.sync.get(DEFAULT_UPLOAD_FOLDER_ID_KEY);
            this.folderTreeContainer.innerHTML = '';
            const tree = this.buildFolderTree(folderData.metadata);
            this.folderTreeContainer.appendChild(tree);
            const selectedLi = this.folderTreeContainer.querySelector(`li[data-folder-id="${currentFolderId}"]`);
            if (selectedLi) selectedLi.classList.add('selected');
            this.updateSelectedPathDisplay(this.buildPath(currentFolderId), currentFolderId);
        } catch (error) {
            console.error('Failed to load folder tree:', error);
            this.folderTreeContainer.textContent = chrome.i18n.getMessage('options_error_loading_folders');
            this.updateSelectedPathDisplay('Error', '');
        }
    }

    updateSelectedPathDisplay(path, id) {
        this.selectedFolderPathDiv.textContent = path;
        if (IS_DEV_MODE) {
            this.devFolderIdSpan.textContent = `(id: ${id})`;
            this.devFolderIdSpan.classList.remove('hidden');
        } else {
            this.devFolderIdSpan.textContent = '';
            this.devFolderIdSpan.classList.add('hidden');
        }
    }

    async handleTreeClick(e) {
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
                this.folderCollapseState[folderId] = !isCollapsing;
                await chrome.storage.local.set({ [FOLDER_STATE_KEY]: this.folderCollapseState });
            }
        } else {
            const path = this.buildPath(folderId);
            await chrome.storage.sync.set({
                [DEFAULT_UPLOAD_FOLDER_ID_KEY]: folderId,
                [DEFAULT_UPLOAD_FOLDER_PATH_KEY]: path
            });
            this.element.querySelectorAll('.folder-tree li.selected').forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
            this.updateSelectedPathDisplay(this.buildPath(folderId), folderId);

            // Dispatch event for snackbar
            window.dispatchEvent(new CustomEvent('options-saved', { detail: { messageKey: 'options_saved_message' } }));
        }
    }
}
