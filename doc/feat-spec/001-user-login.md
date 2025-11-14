# Feature Spec: 001 - User Login

## 1. Feature Title
User Authentication and Session Management

## 2. Description
This feature allows users to securely log into their pCloud account through the Chrome extension. A successful login will grant the extension the necessary permissions to perform actions on behalf of the user, such as uploading files. The session will be persisted locally to avoid requiring login for every browser session.

## 3. UI/UX
- The extension's popup window will display a login form within a **Material Design card** if the user is not authenticated.
- The interface provides two login methods:
  1.  **Email/Password Form:**
      - An email/username input field (`i18n: login_email_placeholder`).
      - A password input field (`i18n: login_password_placeholder`).
      - A "Login" button (`i18n: login_button_text`).
      - A link to switch to token-based login (`i18n: login_switch_to_token`).
  2.  **Auth Token Form:**
      - A textarea for the auth token (`i18n: login_token_placeholder`).
      - A "Verify and Save Token" button (`i18n: login_token_button_text`).
      - A link to switch back to password-based login (`i18n: login_switch_to_password`).
- Error messages (e.g., "Invalid credentials") will be displayed within the card.
- Upon successful login, the popup view will change to the main interface (e.g., the file upload view).
- The overall UI follows **Material Design principles**, featuring larger, rounded corners and a clean, modern aesthetic.

## 4. Technical Details
- **Authentication Flow:**
  - **Password:** User enters credentials and clicks "Login". The extension sends a request to the pCloud API's `userinfo` endpoint.
  - **Token:** User pastes an `auth` token and clicks "Verify". The extension validates it by making a `userinfo` API call.
  - **On Success:** The API returns an `auth` token (or confirms the provided one is valid). This token is securely stored using `chrome.storage.local`.
  - **On Failure:** The API returns an error. The extension displays a user-friendly error message.
- **Session Persistence:**
  - The `auth` token is checked every time the popup is opened.
  - If a valid token exists, the user is considered logged in, and the main interface is displayed.
  - A "Logout" button is available in the main interface, which clears the token from `chrome.storage.local`.

## 5. Internationalization (i18n) Keys
- `login_email_placeholder`: "Email or Username"
- `login_password_placeholder`: "Password"
- `login_button_text`: "Login"
- `login_switch_to_token`: "Or, log in with an auth token"
- `login_token_placeholder`: "Paste your auth token here"
- `login_error_invalid_credentials`: "Login failed. Please check your username and password."
- `login_error_generic`: "An unexpected error occurred. Please try again."
