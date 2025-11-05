// src/background/service-worker.js

/**
 * @fileoverview Background service worker for the pCloud Chrome Extension.
 * Handles extension lifecycle events and background tasks.
 */

// Import necessary modules (will be used later for API calls or auth checks)
// import { getAuthToken, clearAuthToken } from '../core/auth.js';
// import PCloudAPIClient from '../core/pcloud-api.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('pCloud Chrome Extension installed.');
  // Perform any initial setup here, e.g., opening an options page
  // chrome.tabs.create({ url: 'src/options/options.html' });
});

// Example: Listen for messages from other parts of the extension
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.action === 'getAuthStatus') {
//     getAuthToken().then(token => {
//       sendResponse({ isAuthenticated: !!token });
//     });
//     return true; // Indicates that sendResponse will be called asynchronously
//   }
// });

// Add other background event listeners or periodic tasks here
