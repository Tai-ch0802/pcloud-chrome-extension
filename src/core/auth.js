// src/core/auth.js

/**
 * @fileoverview Authentication module for pCloud Chrome Extension.
 * Handles storing, retrieving, and clearing the pCloud authentication token.
 */

const AUTH_TOKEN_STORAGE_KEY = 'pcloud_auth_token';

/**
 * Stores the pCloud authentication token in Chrome's local storage.
 * @param {string} token The authentication token to store.
 * @returns {Promise<void>} A promise that resolves when the token is stored.
 */
export async function setAuthToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid authentication token provided.');
  }
  await chrome.storage.local.set({ [AUTH_TOKEN_STORAGE_KEY]: token });
}

/**
 * Retrieves the pCloud authentication token from Chrome's local storage.
 * @returns {Promise<string | null>} A promise that resolves with the token, or null if not found.
 */
export async function getAuthToken() {
  const result = await chrome.storage.local.get(AUTH_TOKEN_STORAGE_KEY);
  return result[AUTH_TOKEN_STORAGE_KEY] || null;
}

/**
 * Clears the pCloud authentication token from Chrome's local storage.
 * @returns {Promise<void>} A promise that resolves when the token is cleared.
 */
export async function clearAuthToken() {
  await chrome.storage.local.remove(AUTH_TOKEN_STORAGE_KEY);
}

/**
 * Checks if a user is currently authenticated.
 * @returns {Promise<boolean>} A promise that resolves to true if authenticated, false otherwise.
 */
export async function isAuthenticated() {
  const token = await getAuthToken();
  return !!token;
}

/**
 * Initiates the pCloud OAuth 2.0 implicit grant flow.
 * @returns {Promise<string>} A promise that resolves with the access token on success.
 * @throws {Error} Throws an error if the authentication fails or is cancelled.
 */
export async function authenticateWithOAuth() {
  const CLIENT_ID = 'hMoFuTa9OVH';
  // IMPORTANT: The pCloud app must be configured to accept the following redirect URI.
  // Using getRedirectURL is the standard and secure way for Chrome extensions.
  const redirectUri = chrome.identity.getRedirectURL();
  console.log('redirectUri:', redirectUri);

  const authUrl = new URL('https://my.pcloud.com/oauth2/authorize');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('response_type', 'token');
  authUrl.searchParams.append('redirect_uri', redirectUri);

  console.log('[Debug] OAuth Auth URL:', authUrl.toString());

  try {
    const resultUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        (redirect_url) => {
          // The promise is rejected if the auth flow fails.
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(redirect_url);
          }
        }
      );
    });

    console.log('[Debug] OAuth Result URL:', resultUrl);

    if (!resultUrl) {
      // This case handles when the user closes the auth window.
      throw new Error('Authentication flow was cancelled by the user.');
    }

    // The access token is in the URL fragment.
    const urlFragment = new URL(resultUrl).hash.substring(1);
    const params = new URLSearchParams(urlFragment);
    const accessToken = params.get('access_token');

    console.log('[Debug] OAuth Access Token:', accessToken);

    if (!accessToken) {
      console.error("OAuth response did not contain an access token. Response:", resultUrl);
      throw new Error('Access token not found in the pCloud response.');
    }

    await setAuthToken(accessToken);
    return accessToken;

  } catch (error) {
    // Log the detailed error but throw a more generic one for the UI.
    console.error('pCloud OAuth Error:', error.message);
    throw new Error('Authentication failed. Please try again.');
  }
}
