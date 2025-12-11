// src/core/pcloud-api.js

/**
 * @fileoverview pCloud API Client for Chrome Extension.
 * This module provides methods to interact with the pCloud API.
 */

const PCLOUD_API_BASE_URL = "https://api.pcloud.com/";

class PCloudAPIClient {
  /**
   * @param {string} authToken The authentication token for pCloud API.
   */
  constructor(authToken) {
    if (!authToken) {
      throw new Error("PCloudAPIClient requires an authentication token.");
    }
    this.authToken = authToken;
  }

  /**
   * Makes an authenticated request to the pCloud API.
   * @param {string} endpoint The API endpoint (e.g., "userinfo").
   * @param {object} params Query parameters for the request.
   * @param {string} method HTTP method (e.g., "GET", "POST").
   * @param {FormData | null} body Request body for POST/PUT requests.
   * @returns {Promise<object>} The JSON response from the API.
   * @private
   */
  async _request(endpoint, params = {}, method = "GET", body = null) {
    const url = new URL(`${PCLOUD_API_BASE_URL}${endpoint}`);
    url.searchParams.append('access_token', this.authToken);

    // Add other parameters for GET requests
    if (method === "GET" || method === "DELETE") {
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }

    const options = {
      method: method,
      headers: {}
    };

    if (body instanceof FormData) {
      // FormData handles its own Content-Type header, so don't set it manually
      options.body = body;
    } else if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    try {
      const logUrl = new URL(url.toString());
      if (logUrl.searchParams.has('access_token')) {
        logUrl.searchParams.set('access_token', 'REDACTED');
      }
      console.log(`[Debug] pCloud API Request: ${method} ${logUrl.toString()}`);
      const response = await fetch(url.toString(), options);
      const data = await response.json();
      console.log('[Debug] pCloud API Response Data:', data);

      if (data.result !== 0) {
        throw new Error(`pCloud API Error (${data.result}): ${data.error}`);
      }
      return data;
    } catch (error) {
      console.error(`Error calling pCloud API endpoint ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves information about the authenticated user.
   * Corresponds to pCloud API: /userinfo
   * @returns {Promise<object>} User information.
   */
  async getUserInfo() {
    return this._request("userinfo");
  }

  /**
   * Uploads a file to pCloud.
   * NOTE: This method uses fetch() and does not support progress reporting.
   * Corresponds to pCloud API: /uploadfile
   * @param {File} file The File object to upload.
   * @param {number} folderid The ID of the destination folder.
   * @param {string} [filename=file.name] Optional: The desired filename in pCloud. Defaults to original file name.
   * @returns {Promise<object>} Uploaded file metadata.
   */
  async uploadFile(file, folderid = 0, filename = file.name) {
    const formData = new FormData();
    formData.append('folderid', folderid.toString());
    // The third argument to append() is for the filename in the multipart request
    formData.append('file', file, filename);

    const endpoint = 'uploadfile';
    const url = new URL(`${PCLOUD_API_BASE_URL}${endpoint}`);
    url.searchParams.append('access_token', this.authToken);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.result !== 0) {
        throw new Error(`pCloud API Error (${data.result}): ${data.error || 'Unknown error'}`);
      }
      return data;
    } catch (error) {
      console.error(`Error calling pCloud API endpoint ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Lists all folders recursively starting from the root.
   * Corresponds to pCloud API: /listfolder
   * @returns {Promise<object>} The metadata of the root folder, containing nested contents.
   */
  async listAllFolders() {
    const params = {
      path: '/',
      recursive: '1',
      nofiles: '1'
    };
    return this._request("listfolder", params);
  }

  /**
   * Creates a folder if it doesn't already exist.
   * NOTE: This is assumed to be recursive when using the `path` parameter,
   * creating any necessary parent directories.
   * Corresponds to pCloud API: /createfolderifnotexists
   * @param {string} path The full path of the folder to create (e.g., "/My Folder/New Subfolder").
   * @returns {Promise<object>} The metadata of the folder.
   */
  async createFolderIfNotExists(path) {
    return this._request("createfolderifnotexists", { path });
  }

  // Add more API methods as needed (e.g., listfolder, deletefile, etc.)

  /**
   * Lists contents of a specific folder (non-recursive).
   * Useful for lazy loading folder structures.
   * Corresponds to pCloud API: /listfolder
   * @param {number} folderid The ID of the folder to list.
   * @returns {Promise<object>} The metadata of the folder.
   */
  async listFolder(folderid) {
    const params = {
      folderid: folderid,
      recursive: '0',
      nofiles: '1'
    };
    return this._request("listfolder", params);
  }

  /**
   * Creates a new folder.
   * Corresponds to pCloud API: /createfolder
   * @param {number} folderid The parent folder ID.
   * @param {string} name The name of the new folder.
   * @returns {Promise<object>} The metadata of the created folder.
   */
  async createFolder(folderid, name) {
    const params = {
      folderid: folderid,
      name: name
    };
    return this._request("createfolder", params);
  }
}

export default PCloudAPIClient;
