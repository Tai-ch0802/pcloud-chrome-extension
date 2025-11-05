// src/popup/popup.js

import { getAuthToken, setAuthToken, clearAuthToken, isAuthenticated } from '../core/auth.js';
import PCloudAPIClient from '../core/pcloud-api.js';

const DEFAULT_UPLOAD_FOLDER_ID_KEY = 'default_upload_folder_id';

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');

// Login forms and toggles
const loginFormPassword = document.getElementById('login-form-password');
const loginFormToken = document.getElementById('login-form-token');
const switchToTokenLink = document.getElementById('switch-to-token');
const switchToPasswordLink = document.getElementById('switch-to-password');

// Password login elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButtonPassword = document.getElementById('login-button-password');
const loginErrorPassword = document.getElementById('login-error-password');

// Token login elements
const authTokenInput = document.getElementById('auth-token');
const loginButtonToken = document.getElementById('login-button-token');
const loginErrorToken = document.getElementById('login-error-token');

// Main view elements
const logoutButton = document.getElementById('logout-button');
const optionsButton = document.getElementById('options-button');
const currentUploadPathDiv = document.getElementById('current-upload-path');
const uploadSuccess = document.getElementById('upload-success');
const uploadError = document.getElementById('upload-error');
const fileInput = document.getElementById('file-input');
const selectFileButton = document.getElementById('select-file-button');
const selectedFileNameSpan = document.getElementById('selected-file-name');
const uploadButton = document.getElementById('upload-button');
const uploadProgressBar = document.getElementById('upload-progress');

// --- State ---
let folderMap = new Map();

// --- Helper Functions ---

function localizeHtml() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = chrome.i18n.getMessage(el.dataset.i18nTitle);
  });
}

function showView(view) {
  [loginView, mainView].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

function displayLoginError(message, formType) {
  const errorEl = formType === 'password' ? loginErrorPassword : loginErrorToken;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearLoginErrors() {
  loginErrorPassword.textContent = '';
  loginErrorPassword.classList.add('hidden');
  loginErrorToken.textContent = '';
  loginErrorToken.classList.add('hidden');
}

function displayUploadMessage(messageKey, type = 'success') {
  const element = type === 'success' ? uploadSuccess : uploadError;
  const otherElement = type === 'success' ? uploadError : uploadSuccess;
  element.textContent = chrome.i18n.getMessage(messageKey);
  element.classList.remove('hidden');
  otherElement.classList.add('hidden');
}

function clearUploadMessages() {
  uploadSuccess.classList.add('hidden');
  uploadError.classList.add('hidden');
}

function updateProgressBar(percentage) {
  uploadProgressBar.style.width = `${percentage}%`;
  uploadProgressBar.textContent = `${percentage}%`;
}

async function handleSuccessfulLogin(token) {
  await setAuthToken(token);
  await updateCurrentUploadPathDisplay();
  showView(mainView);
}

// --- Path and Upload Logic ---

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

async function updateCurrentUploadPathDisplay() {
  try {
    const authToken = await getAuthToken();
    if (!authToken) return;

    const client = new PCloudAPIClient(authToken);
    const folderData = await client.listAllFolders();
    folderMap.clear();
    flattenFolders(folderData.metadata);

    const { [DEFAULT_UPLOAD_FOLDER_ID_KEY]: folderId = 0 } = await chrome.storage.sync.get(DEFAULT_UPLOAD_FOLDER_ID_KEY);
    const path = buildPath(folderId);
    currentUploadPathDiv.textContent = path;

  } catch (error) {
    console.error('Could not update upload path display:', error);
    currentUploadPathDiv.textContent = 'Error loading path';
  }
}

// --- Event Listeners ---

// View Toggling
switchToTokenLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginFormPassword.classList.add('hidden');
  loginFormToken.classList.remove('hidden');
  clearLoginErrors();
});

switchToPasswordLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginFormToken.classList.add('hidden');
  loginFormPassword.classList.remove('hidden');
  clearLoginErrors();
});

optionsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Login/Logout
loginButtonPassword.addEventListener('click', async () => {
  clearLoginErrors();
  const email = emailInput.value;
  const password = passwordInput.value;
  if (!email || !password) {
    displayLoginError(chrome.i18n.getMessage('login_error_empty_credentials'), 'password');
    return;
  }
  loginButtonPassword.disabled = true;
  try {
    const authUrl = new URL(`https://api.pcloud.com/userinfo`);
    authUrl.searchParams.append('username', email);
    authUrl.searchParams.append('password', password);
    authUrl.searchParams.append('getauth', '1');
    const response = await fetch(authUrl.toString());
    const data = await response.json();
    if (data.result === 0 && data.auth) {
      await handleSuccessfulLogin(data.auth);
    } else {
      displayLoginError(chrome.i18n.getMessage('login_error_invalid_credentials'), 'password');
    }
  } catch (error) {
    displayLoginError(chrome.i18n.getMessage('login_error_generic'), 'password');
  } finally {
    loginButtonPassword.disabled = false;
  }
});

loginButtonToken.addEventListener('click', async () => {
  clearLoginErrors();
  const token = authTokenInput.value.trim();
  if (!token) {
    displayLoginError(chrome.i18n.getMessage('login_error_invalid_token'), 'token');
    return;
  }
  loginButtonToken.disabled = true;
  try {
    const tempClient = new PCloudAPIClient(token);
    await tempClient.getUserInfo();
    await handleSuccessfulLogin(token);
  } catch (error) {
    displayLoginError(chrome.i18n.getMessage('login_error_invalid_token'), 'token');
  } finally {
    loginButtonToken.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  await clearAuthToken();
  showView(loginView);
  loginFormToken.classList.add('hidden');
  loginFormPassword.classList.remove('hidden');
  emailInput.value = '';
  passwordInput.value = '';
  authTokenInput.value = '';
  clearLoginErrors();
  clearUploadMessages();
  updateProgressBar(0);
  selectedFileNameSpan.textContent = '';
  fileInput.value = '';
  uploadButton.disabled = true;
});

// File Upload
selectFileButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    selectedFileNameSpan.textContent = fileInput.files[0].name;
    uploadButton.disabled = false;
    clearUploadMessages();
    updateProgressBar(0);
  } else {
    selectedFileNameSpan.textContent = '';
    uploadButton.disabled = true;
  }
});

uploadButton.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) {
    displayUploadMessage('upload_error_no_file', 'error');
    return;
  }
  const authToken = await getAuthToken();
  if (!authToken) {
    displayUploadMessage('upload_error_no_auth', 'error');
    return;
  }
  uploadButton.disabled = true;
  selectFileButton.disabled = true;
  clearUploadMessages();
  updateProgressBar(0);
  try {
    const client = new PCloudAPIClient(authToken);
    const onProgress = (percentage) => updateProgressBar(percentage);
    const { [DEFAULT_UPLOAD_FOLDER_ID_KEY]: folderId = 0 } = await chrome.storage.sync.get(DEFAULT_UPLOAD_FOLDER_ID_KEY);
    
    console.log('Uploading to folderId:', folderId);

    const result = await client.uploadFile(file, folderId, onProgress);
    if (result.metadata && result.metadata.length > 0) {
      displayUploadMessage('upload_success_message', 'success');
    } else {
      throw new Error('Upload completed but no metadata received.');
    }
  } catch (error) {
    console.error('Upload failed:', error);
    displayUploadMessage('upload_error_generic', 'error');
    updateProgressBar(0);
  } finally {
    uploadButton.disabled = false;
    selectFileButton.disabled = false;
    fileInput.value = '';
  }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
  localizeHtml();
  if (await isAuthenticated()) {
    await updateCurrentUploadPathDisplay();
    showView(mainView);
  } else {
    showView(loginView);
    loginFormToken.classList.add('hidden');
    loginFormPassword.classList.remove('hidden');
  }
});

// Listen for changes from the options page
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[DEFAULT_UPLOAD_FOLDER_ID_KEY]) {
    updateCurrentUploadPathDisplay();
  }
});