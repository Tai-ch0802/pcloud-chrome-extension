# Feature Spec: 003 - Save Image to pCloud via Context Menu

## 1. Feature Title
Save Image to pCloud via Context Menu

## 2. Description
This feature enables users to save images from any website directly to their pCloud account. When a user right-clicks on an image, a "Save image to pCloud" option appears in the browser's context menu. Selecting this option initiates the upload of the image to the user's pCloud account. This is a free-tier feature.

## 3. Pre-conditions
- User must be logged in (i.e., a valid `auth` token must be present in `chrome.storage.local`).

## 4. UI/UX
- When a user right-clicks on an image (`<img>` tag, or any element with a background image), a new item appears in the browser's context menu.
- The menu item will be labeled "Save image to pCloud" (`i18n: context_menu_save_image`).
- Upon clicking the menu item, a browser notification will appear to provide feedback on the upload status.
  - **Initial Notification:** Title: "Image Upload" (`i18n: notification_upload_started_title`), Message: "Saving image to your pCloud..." (`i18n: notification_upload_started_message`).
  - **Success Notification:** Title: "Upload Complete" (`i18n: notification_upload_success_title`), Message: "Image successfully saved to pCloud." (`i18n: notification_upload_success_message`).
  - **Error Notification:** Title: "Upload Failed" (`i18n: notification_upload_error_title`), Message: "Could not save image to pCloud. Please try again." (`i18n: notification_upload_error_message`).
  - **Authentication Error:** If the user is not logged in, the notification will prompt them to do so: "Please log in to the pCloud extension to save files." (`i18n: notification_auth_error_message`).

## 5. Technical Details
- **Architecture:**
  - The feature will be implemented using the `chrome.contextMenus` API.
  - The context menu item will be created in the background service worker (`src/background/service-worker.js`). It will be configured to appear only when the user right-clicks on an image (`context: 'image'`).
  - An `onClicked` event listener in the service worker will handle the logic when the menu item is selected.
- **Upload Flow:**
  1. The `onClicked` listener in `service-worker.js` is triggered, providing the `srcUrl` of the selected image.
  2. The service worker checks for a valid `auth` token using `chrome.storage.local`. If no token is found, it displays the authentication error notification and stops.
  3. If authenticated, the service worker will call the pCloud API to save the image from the given URL. The `uploadfile` method from the API seems appropriate, where the file content is fetched from the `srcUrl` and then streamed to the API. A potentially better alternative is to use an API endpoint that downloads directly from a URL, if available (e.g., `downloadfileasync` or similar).
  4. A default upload folder will be used, for instance, `/pCloud Chrome Extension Uploads`. The service worker will ensure this folder exists, creating it if necessary.
  5. The `chrome.notifications` API will be used to create and manage user feedback notifications throughout the process.
- **Permissions:**
  - The `manifest.json` file will need to be updated to include the `contextMenus` and `notifications` permissions.

## 6. Internationalization (i18n) Keys
- `context_menu_save_image`: "Save image to pCloud"
- `notification_upload_started_title`: "Image Upload"
- `notification_upload_started_message`: "Saving image to your pCloud..."
- `notification_upload_success_title`: "Upload Complete"
- `notification_upload_success_message`: "Image successfully saved to pCloud."
- `notification_upload_error_title`: "Upload Failed"
- `notification_upload_error_message`: "Could not save image to pCloud. Please try again."
- `notification_auth_error_message`: "Please log in to the pCloud extension to save files."
