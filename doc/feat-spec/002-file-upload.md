# Feature Spec: 002 - File Upload

## 1. Feature Title
Direct File Upload to pCloud

## 2. Description
This feature allows authenticated users to select a file from their local machine and upload it directly to a pre-defined or selected folder in their pCloud account. This is a core "free" tier feature.

## 3. Pre-conditions
- User must be logged in (i.e., a valid `auth` token must be present in `chrome.storage.local`).

## 4. UI/UX
- The main popup interface will feature:
  - A "Select File" button (`i18n: upload_select_file_button`).
  - A text area or label to display the name of the selected file.
  - An "Upload" button (`i18n: upload_button_text`) which is enabled only after a file is selected.
  - A progress bar to show upload progress.
  - A status message area to display feedback (e.g., "Uploading...", "Upload successful!", "Error: ...").
- The user can choose the destination folder in pCloud (optional for v1, can default to root).

## 5. Technical Details
- **Upload Flow:**
  1. User clicks "Select File" which opens the system's file picker.
  2. After a file is selected, the "Upload" button is enabled.
  3. User clicks "Upload".
  4. The extension retrieves the `auth` token from `chrome.storage.local`.
  5. It makes a `multipart/form-data` POST request to the pCloud API's `uploadfile` endpoint.
  6. The request body will include the file data, the `auth` token, and optionally a `folderid` or `path`.
  7. The extension will listen to progress events to update the progress bar in the UI.
  8. **On Success:** The API returns metadata of the uploaded file. The UI displays a success message (`i18n: upload_success_message`).
  9. **On Failure:** The API returns an error. The UI displays a relevant error message (`i18n: upload_error_generic`).

## 6. Internationalization (i18n) Keys
- `upload_select_file_button`: "Select File"
- `upload_button_text`: "Upload"
- `upload_status_uploading`: "Uploading..."
- `upload_success_message`: "File uploaded successfully!"
- `upload_error_generic`: "Upload failed. Please try again."
- `upload_error_no_auth`: "Authentication error. Please log in again."
