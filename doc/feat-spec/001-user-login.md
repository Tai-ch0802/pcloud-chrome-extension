# Feature Spec: 001 - User Login

## 1. Feature Title
User Authentication and Session Management (OAuth 2.0)

## 2. Description
This feature allows users to securely log into their pCloud account through the Chrome extension using the official pCloud OAuth 2.0 flow. A successful login will grant the extension the necessary permissions to perform actions on behalf of the user, such as uploading files. The session will be persisted locally to avoid requiring login for every browser session.

## 3. UI/UX
- The extension's popup window will display a login view within a **Material Design card** if the user is not authenticated.
- The interface provides a single, simple login method:
  - A "Login with pCloud" button (`i18n: login_oauth_button`).
- Clicking the button opens a new popup window managed by the browser, showing the official pCloud authorization screen.
- Error messages (e.g., "Authentication failed") will be displayed within the card if the process fails.
- Upon successful login, the popup view will change to the main interface (e.g., the file upload view).
- The overall UI follows **Material Design principles**, featuring larger, rounded corners and a clean, modern aesthetic.

## 4. Technical Details
- **Authentication Flow:**
  - **Initiation:** The user clicks the "Login with pCloud" button.
  - **Authorization:** The extension calls `chrome.identity.launchWebAuthFlow`, which opens a popup with the pCloud authorization URL. The `response_type` is set to `token` to follow the Implicit Grant flow.
  - **Redirect:** After the user grants permission, pCloud redirects to a URL specific to the extension, provided by `chrome.identity.getRedirectURL()`.
  - **Token Extraction:** The `access_token` is extracted from the fragment (#) of the redirect URL.
  - **On Success:** The `access_token` is securely stored using `chrome.storage.local`.
  - **On Failure:** If the user cancels the flow or an error occurs, the extension displays a user-friendly error message.
- **Session Persistence:**
  - The `access_token` is checked every time the popup is opened.
  - If a valid token exists, the user is considered logged in, and the main interface is displayed.
  - A "Logout" button is available in the main interface, which clears the token from `chrome.storage.local`.
- **API Calls:**
  - All subsequent calls to the pCloud API must use this `access_token` as a URL parameter (e.g., `?access_token=...`).

## 5. Internationalization (i18n) Keys
- `login_prompt`: "Login to pCloud"
- `login_oauth_button`: "Login with pCloud"
- `login_oauth_error`: "Authentication failed. Please try again."
