import { getAuthToken } from '../../../core/auth.js';
import PCloudAPIClient from '../../../core/pcloud-api.js';
import { matchDomainRule } from '../../../core/utils.js';

const DOMAIN_RULES_KEY = 'domain_upload_rules';

export default class DomainRulesSection {
    constructor() {
        this.element = null;
        this.rules = [];
        this.listEl = null;
        this.addBtn = null;
        this.helpBtn = null;
        this.testToggleBtn = null;
        this.testPlayground = null;
        this.testInput = null;
        this.testResult = null;

        // Dialogs
        this.ruleEditorDialog = null;
        this.folderPickerDialog = null;
        this.helpDialog = null;

        // Editor Elements
        this.editorDomainInput = null;
        this.editorPathInput = null;
        this.editorFolderIdInput = null;
        this.editorFolderPickerBtn = null;
        this.editorTitle = null;

        // Folder Picker Elements
        this.pickerTreeContainer = null;
        this.newFolderNameInput = null;
        this.createFolderBtn = null;
        this.pickerSelectBtn = null;
        this.pickerSelectedFolderId = null;
        this.pickerSelectedFolderPath = null;

        this.editingRuleId = null;

        // MDC Instances
        this.domainInputMDC = null;
        this.pathInputMDC = null;
        this.newFolderInputMDC = null;
        this.testInputMDC = null;
    }

    async render() {
        const response = await fetch(chrome.runtime.getURL('src/options/sections/domain-rules/template.html'));
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // The template contains multiple top-level elements (card + dialogs).
        // We need to return a container or append them all.
        // Let's wrap them in a div for now, or just return the fragment.
        // But `render` expects to return an element to append.
        // The `options.js` will append `this.element`.
        // So we should wrap everything in a div.
        const container = document.createElement('div');
        while (doc.body.firstChild) {
            container.appendChild(doc.body.firstChild);
        }
        this.element = container;
        return this.element;
    }

    async init() {
        this.listEl = this.element.querySelector('#domain-rules-list');
        this.addBtn = this.element.querySelector('#add-rule-btn');
        this.helpBtn = this.element.querySelector('#domain-rules-help-btn');
        this.testToggleBtn = this.element.querySelector('#test-playground-toggle-btn');
        this.testPlayground = this.element.querySelector('#test-playground');
        this.testInput = this.element.querySelector('#test-url-input');
        this.testResult = this.element.querySelector('#test-result');

        this.ruleEditorDialog = new mdc.dialog.MDCDialog(this.element.querySelector('#rule-editor-dialog'));
        this.folderPickerDialog = new mdc.dialog.MDCDialog(this.element.querySelector('#folder-picker-dialog'));
        this.helpDialog = new mdc.dialog.MDCDialog(this.element.querySelector('#help-dialog'));

        this.editorDomainInput = this.element.querySelector('#rule-domain-input');
        this.editorPathInput = this.element.querySelector('#rule-path-input');
        this.editorFolderIdInput = this.element.querySelector('#rule-folder-id-input');
        this.editorFolderPickerBtn = this.element.querySelector('#rule-folder-picker-btn');
        this.editorTitle = this.element.querySelector('#rule-editor-title');

        this.pickerTreeContainer = this.element.querySelector('#picker-folder-tree');
        this.newFolderNameInput = this.element.querySelector('#new-folder-name-input');
        this.createFolderBtn = this.element.querySelector('#create-folder-btn');
        this.pickerSelectBtn = this.element.querySelector('#folder-picker-dialog [data-mdc-dialog-action="select"]');

        this.domainInputMDC = new mdc.textField.MDCTextField(this.editorDomainInput.closest('.mdc-text-field'));
        this.pathInputMDC = new mdc.textField.MDCTextField(this.editorPathInput.closest('.mdc-text-field'));
        this.newFolderInputMDC = new mdc.textField.MDCTextField(this.newFolderNameInput.closest('.mdc-text-field'));
        this.testInputMDC = new mdc.textField.MDCTextField(this.testInput.closest('.mdc-text-field'));

        const { [DOMAIN_RULES_KEY]: savedRules = [] } = await chrome.storage.sync.get(DOMAIN_RULES_KEY);
        this.rules = savedRules;
        this.renderRules();
        this.bindEvents();
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

        this.setupDragAndDrop();
    }

    renderRules() {
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

            const switchEl = tr.querySelector('.mdc-switch');
            // const switchControl = new mdc.switchControl.MDCSwitch(switchEl); // Not strictly needed if we just handle click

            switchEl.addEventListener('click', () => {
                this.toggleRule(rule.id, !rule.enabled);
            });

            tr.querySelector('.edit-rule-btn').addEventListener('click', () => this.openEditor(rule.id));
            tr.querySelector('.delete-rule-btn').addEventListener('click', () => this.confirmDelete(rule.id));
        });
    }

    async saveRules() {
        await chrome.storage.sync.set({ [DOMAIN_RULES_KEY]: this.rules });
        this.renderRules();
        this.showStatusMessage('options_saved_message');
        this.runTest();
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
            this.editorFolderIdInput.value = rule.targetFolderId || 0;
            this.editorTitle.textContent = chrome.i18n.getMessage('options_domain_rules_dialog_title_edit');
        } else {
            this.domainInputMDC.value = '';
            this.pathInputMDC.value = '';
            this.editorFolderIdInput.value = '';
            this.editorTitle.textContent = chrome.i18n.getMessage('options_domain_rules_dialog_title_add');
        }
        // localizeHtml(); // Assuming global or we need to implement it
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

        const matchedRule = matchDomainRule(url, this.rules);

        this.testResult.className = 'test-result';
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
        li.dataset.loaded = 'false';
        li.classList.add('collapsed');

        const itemDiv = document.createElement('div');
        itemDiv.className = 'folder-item';

        const toggleIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        toggleIcon.setAttribute('class', 'icon toggle-icon');
        toggleIcon.setAttribute('viewBox', '0 0 24 24');
        toggleIcon.innerHTML = `<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>`;
        itemDiv.appendChild(toggleIcon);

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

        const ul = document.createElement('ul');
        ul.classList.add('hidden');
        li.appendChild(ul);

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

        this.element.querySelectorAll('#picker-folder-tree li.selected').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        this.pickerSelectedFolderId = folderId;
        this.pickerSelectedFolderPath = this.buildPathFromDom(li);
        this.pickerSelectBtn.disabled = false;

        if (e.target.closest('.toggle-icon')) {
            const ul = li.querySelector('ul');
            const isCollapsed = li.classList.contains('collapsed');

            if (isCollapsed) {
                li.classList.remove('collapsed');
                ul.classList.remove('hidden');

                if (li.dataset.loaded === 'false') {
                    try {
                        const data = await this.pCloudClient.listFolder(folderId);
                        ul.innerHTML = '';
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
            if (name === '/') name = '';
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
            const selectedLi = this.pickerTreeContainer.querySelector(`li[data-folder-id="${this.pickerSelectedFolderId}"]`);
            if (selectedLi) {
                selectedLi.dataset.loaded = 'false';
                selectedLi.classList.add('collapsed');
                const toggleIcon = selectedLi.querySelector('.toggle-icon');
                toggleIcon.dispatchEvent(new Event('click', { bubbles: true }));
            }
            this.newFolderNameInput.value = '';
            this.showStatusMessage('options_saved_message');
        } catch (error) {
            console.error('Create folder failed', error);
            alert('Failed to create folder: ' + error.message);
        }
    }

    showStatusMessage(messageKey) {
        window.dispatchEvent(new CustomEvent('options-saved', { detail: { messageKey } }));
    }
}
