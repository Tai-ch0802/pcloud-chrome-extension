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
    url.searchParams.append('auth', this.authToken);

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
      const response = await fetch(url.toString(), options);
      const data = await response.json();

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
   * Uploads a file to pCloud with progress reporting.
   * Corresponds to pCloud API: /uploadfile
   * @param {File} file The File object to upload.
   * @param {number} folderid The ID of the destination folder.
   * @param {function(number): void} onProgress A callback function to report upload progress (0-100).
   * @param {string} [filename=file.name] Optional: The desired filename in pCloud. Defaults to original file name.
   * @returns {Promise<object>} Uploaded file metadata.
   */
  async uploadFile(file, folderid = 0, onProgress, filename = file.name) {
    const formData = new FormData();
    formData.append('folderid', folderid.toString());
    formData.append('filename', file, filename);

    return this._uploadRequest("uploadfile", formData, onProgress);
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
   * Makes an authenticated upload request using XMLHttpRequest for progress tracking.
   * @param {string} endpoint The API endpoint (e.g., "uploadfile").
   * @param {FormData} formData The FormData object to upload.
   * @param {function(number): void} onProgress A callback function to report upload progress (0-100).
   * @returns {Promise<object>} The JSON response from the API.
   * @private
   */
  _uploadRequest(endpoint, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = new URL(`${PCLOUD_API_BASE_URL}${endpoint}`);
      url.searchParams.append('auth', this.authToken);

      xhr.open("POST", url.toString(), true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          if (onProgress) {
            onProgress(percentComplete);
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            console.log("--- Upload Response ---");
            console.log(xhr.responseText);
            console.log("-----------------------");
            const data = JSON.parse(xhr.responseText);
            if (data.result !== 0) {
              reject(new Error(`pCloud API Error (${data.result}): ${data.error}`));
            } else {
              resolve(data);
            }
          } catch (e) {
            reject(new Error("Failed to parse API response."));
          }
        } else {
          reject(new Error(`Request failed with status: ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error during upload."));
      };

      console.log("--- Upload Parameters ---");
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`${key}:`, value.name);
        } else {
          console.log(`${key}:`, value);
        }
      }
      console.log("-------------------------");

      xhr.send(formData);
    });
  }

  // Add more API methods as needed (e.g., listfolder, deletefile, etc.)
}

export default PCloudAPIClient;
