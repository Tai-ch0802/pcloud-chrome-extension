# Feature Spec: 001 - User Login

## 1. Feature Title
User Authentication and Session Management

## 2. Description
This feature allows users to securely log into their pCloud account through the Chrome extension. A successful login will grant the extension the necessary permissions to perform actions on behalf of the user, such as uploading files. The session will be persisted locally to avoid requiring login for every browser session.

## 3. UI/UX
- The extension's popup window will display a login form if the user is not authenticated.
- The form will contain:
  - An email/username input field (`i18n: login_email_placeholder`).
  - A password input field (`i18n: login_password_placeholder`).
  - A "Login" button (`i18n: login_button_text`).
  - An area to display error messages (e.g., "Invalid credentials", `i18n: login_error_invalid_credentials`).
- Upon successful login, the popup view will change to the main interface (e.g., the file upload view).

## 4. Technical Details
- **Authentication Flow:**
  1. User enters credentials and clicks "Login".
  2. The extension sends a request to the pCloud API's `userinfo` endpoint with the provided credentials.
  3. **On Success:** The API returns an `auth` token. This token must be securely stored using `chrome.storage.local`.
  4. **On Failure:** The API returns an error. The extension will display a user-friendly error message based on the response.
- **Session Persistence:**
  - The `auth` token is checked every time the popup is opened.
  - If a valid token exists, the user is considered logged in, and the main interface is displayed.
  - A "Logout" button will be available in the main interface or settings page, which will clear the token from `chrome.storage.local`.

## 5. Internationalization (i18n) Keys
- `login_email_placeholder`: "Email or Username"
- `login_password_placeholder`: "Password"
- `login_button_text`: "Login"
- `login_error_invalid_credentials`: "Login failed. Please check your username and password."
- `login_error_generic`: "An unexpected error occurred. Please try again."
