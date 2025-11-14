# Feature Spec: 002 - File Upload

## 1. Feature Title
Direct and Drag-and-Drop File Upload to pCloud

## 2. Description
This feature allows authenticated users to upload files from their local machine directly to a selected folder in their pCloud account. It supports both traditional file selection and a modern drag-and-drop interface. This is a core "free" tier feature.

## 3. Pre-conditions
- User must be logged in (i.e., a valid `auth` token must be present in `chrome.storage.local`).

## 4. UI/UX
- The main popup interface is presented as a **Material Design card**.
- It displays user information: email and storage quota.
- It shows the **currently selected upload path**.
- The core upload interface consists of a **drag-and-drop zone** (`i18n: upload_drag_and_drop_prompt`).
  - Users can drag one or more files directly into this area to initiate an upload.
  - A link is also provided to open the system's file picker for traditional selection (`i18n: upload_select_file_link`).
- Once files are selected or dropped, an **upload list** appears.
  - Each file is displayed as an item in the list with its name and a progress bar.
  - The UI provides real-time feedback on the status of each upload (e.g., "Uploading...", "Done", "Error").
  - Completed items are automatically removed from the list after a short countdown.
- The overall UI follows **Material Design principles**, ensuring a cohesive and modern user experience.

## 5. Technical Details
- **Architecture:** The upload process is managed by a **background service worker (`service-worker.js`)**, which acts as the central state manager for all upload tasks.
- **Upload Flow:**
  1. User selects files via the file picker or drops them onto the drop zone in the popup.
  2. `popup.js` reads the file(s) as Data URLs and sends a `startUploadFromFile` message to the service worker.
  3. The service worker receives the message, adds the task(s) to a central `uploads` array, and begins the upload process.
  4. It makes a `fetch` request to the pCloud API's `uploadfile` endpoint.
  5. The service worker broadcasts `uploadStateUpdate` messages to all UI components (e.g., the popup) to keep the progress display synchronized.
  6. **On Success:** The file's status in the central state is updated to "done".
  7. **On Failure:** The status is updated to "error".
- **State Synchronization:** The popup UI (`popup.js`) is a passive view that simply listens for state updates from the service worker and renders the upload list accordingly. This ensures UI consistency even if the popup is closed and reopened during an upload.

## 6. Internationalization (i18n) Keys
- `upload_drag_and_drop_prompt`: "Drag & drop files here to upload"
- `upload_select_file_link`: "Or select files"
- `upload_success_message`: "File uploaded successfully!"
- `upload_error_generic`: "Upload failed. Please try again."
- `upload_error_no_auth`: "Authentication error. Please log in again."
