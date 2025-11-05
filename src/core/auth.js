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
