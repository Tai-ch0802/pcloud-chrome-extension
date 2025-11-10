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
const userEmailSpan = document.getElementById('user-email'); // New element
const quotaInfoDiv = document.getElementById('quota-info');
const quotaTextDiv = document.getElementById('quota-text');
const quotaProgressBar = document.getElementById('quota-progress');
const currentUploadPathDiv = document.getElementById('current-upload-path');
const fileInput = document.getElementById('file-input');

// New upload UI elements
const dropZone = document.getElementById('drop-zone');
const dropZoneText = document.getElementById('drop-zone-text');
const uploadList = document.getElementById('upload-list');
const selectFileLink = document.getElementById('select-file-link');

// General status messages
const uploadSuccess = document.getElementById('upload-success');
const uploadError = document.getElementById('upload-error');


// --- State ---
let folderMap = new Map();
let uploads = []; // To manage multiple uploads state

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

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function handleSuccessfulLogin(token) {
  await setAuthToken(token);
  await Promise.all([
    updateCurrentUploadPathDisplay(),
    updateUserInfoDisplay()
  ]);
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

async function updateUserInfoDisplay() {
  try {
    const authToken = await getAuthToken();
    if (!authToken) return;

    const client = new PCloudAPIClient(authToken);
    const userInfo = await client.getUserInfo();
    if (userInfo && userInfo.email) {
      userEmailSpan.textContent = userInfo.email;
    }

    if (userInfo && typeof userInfo.quota !== 'undefined' && typeof userInfo.usedquota !== 'undefined') {
        const { quota, usedquota } = userInfo;
        const usedFormatted = formatBytes(usedquota);
        const totalFormatted = formatBytes(quota);
        const percentage = quota === 0 ? 0 : (usedquota / quota) * 100;

        quotaTextDiv.textContent = `${usedFormatted} / ${totalFormatted}`;
        quotaProgressBar.style.width = `${percentage.toFixed(2)}%`;
        quotaProgressBar.textContent = `${percentage.toFixed(2)}%`;
        quotaInfoDiv.classList.remove('hidden');
    }

  } catch (error) {
    console.error('Could not fetch user info:', error);
    userEmailSpan.textContent = 'Could not load user';
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
  userEmailSpan.textContent = '';
  quotaInfoDiv.classList.add('hidden');
  clearLoginErrors();
  
  // Clear upload state
  uploads = [];
  fileInput.value = '';
  renderUploads();
});



// --- Initial Load ---







function renderUploads() {



    uploadList.innerHTML = ''; // Clear the list







    if (uploads.length > 0) {



        dropZoneText.classList.add('hidden');



    } else {



        dropZoneText.classList.remove('hidden');



    }







    uploads.forEach(upload => {



        const item = document.createElement('div');



        item.className = 'upload-item';



        item.id = `upload-${upload.id}`;







        let statusHTML = '';



        if (upload.status === 'uploading') {



            statusHTML = `<div class="upload-item-status">${upload.progress}%</div>`;



        } else if (upload.status === 'done') {



            statusHTML = `<div class="upload-item-status status-done">Done</div>`;



        } else if (upload.status === 'clearing') {



            statusHTML = `<div class="upload-item-status">Removing in ${upload.countdown}s...</div>`;



        } else if (upload.status === 'error') {



            statusHTML = `<div class="upload-item-status status-error">Error</div>`;



        }







        item.innerHTML = `



            <div class="upload-item-info">



                <div class="file-name" title="${upload.file.name}">${upload.file.name}</div>



                <div class="item-progress-bar-container">



                    <div class="item-progress-bar" style="width: ${upload.progress}%"></div>



                </div>



            </div>



            ${statusHTML}



        `;



        uploadList.appendChild(item);



    });



}







async function startUpload(uploadId, file) {



    const upload = uploads.find(u => u.id === uploadId);



    if (!upload) return;







    try {



        const authToken = await getAuthToken();



        if (!authToken) throw new Error('Not authenticated');







        const client = new PCloudAPIClient(authToken);



        const { [DEFAULT_UPLOAD_FOLDER_ID_KEY]: folderId = 0 } = await chrome.storage.sync.get(DEFAULT_UPLOAD_FOLDER_ID_KEY);







        const onProgress = (percentage) => {



            upload.progress = percentage;



            renderUploads();



        };







        const result = await client.uploadFile(file, folderId, onProgress);







                if (result.metadata && result.metadata.length > 0) {







                    upload.status = 'done';







                    renderUploads();







        







                    // Set item to be cleared by the global countdown timer







                    setTimeout(() => {







                        upload.status = 'clearing';







                        upload.countdown = 30;







                        renderUploads();







                    }, 500); // Short delay to show "Done" status







        







                } else {







                    throw new Error('Upload completed but no metadata received.');







                }







            } catch (error) {







                console.error('Upload failed:', error);







                upload.status = 'error';







                renderUploads();







            }







        }







        







        function handleFiles(files) {







            if (!files || files.length === 0) return;







        







            for (const file of files) {







                const newUpload = {







                    id: Date.now() + '-' + Math.random(), // Simple unique ID







                    file: file,







                    progress: 0,







                    status: 'uploading', // 'uploading', 'done', 'clearing', 'error'







                    countdown: 30,







                };







                uploads.push(newUpload);







                startUpload(newUpload.id, newUpload.file);







            }







            renderUploads();







        }







        







        // --- Global Countdown Timer ---







        setInterval(() => {







            let changed = false;







            uploads.forEach(upload => {







                if (upload.status === 'clearing') {







                    upload.countdown--;







                    changed = true;







                }







            });







        







            const newUploads = uploads.filter(u => u.countdown > 0 || u.status !== 'clearing');







            if (newUploads.length !== uploads.length) {







                changed = true;







            }







            uploads = newUploads;







        







            if (changed) {







                renderUploads();







            }







        }, 1000);







        







        document.addEventListener('DOMContentLoaded', async () => {







          localizeHtml();







          if (await isAuthenticated()) {







            await Promise.all([







              updateCurrentUploadPathDisplay(),







              updateUserInfoDisplay()







            ]);



    showView(mainView);



  } else {



    showView(loginView);



    loginFormToken.classList.add('hidden');



    loginFormPassword.classList.remove('hidden');



  }



});







// --- New Event Listeners for Drag and Drop ---







dropZone.addEventListener('dragover', (e) => {



    e.preventDefault();



    dropZone.classList.add('dragover');



});







dropZone.addEventListener('dragleave', (e) => {



    e.preventDefault();



    dropZone.classList.remove('dragover');



});







dropZone.addEventListener('drop', (e) => {



    e.preventDefault();



    dropZone.classList.remove('dragover');



    handleFiles(e.dataTransfer.files);



});







selectFileLink.addEventListener('click', (e) => {



    e.preventDefault();



    fileInput.click();



});







fileInput.addEventListener('change', () => {



    handleFiles(fileInput.files);



});











// Listen for changes from the options page

chrome.storage.onChanged.addListener((changes, namespace) => {

  if (namespace === 'sync' && changes[DEFAULT_UPLOAD_FOLDER_ID_KEY]) {

    updateCurrentUploadPathDisplay();

  }

});
