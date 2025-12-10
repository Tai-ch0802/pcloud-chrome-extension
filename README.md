# HyperCmdC for pCloud

A powerful Chrome extension that integrates pCloud into your browsing experience. Save images, text selections, and entire document sections directly to your pCloud account with a single click.

## Features

*   **Context Menu Integration**: Right-click on any webpage to access pCloud tools.
    *   **Save Image**: Upload images directly to pCloud.
    *   **Save Selection as Text**: Save selected text as a Markdown file.
    *   **Save Selection as Document**: Convert selected content (including images) into a Markdown (`.md`) or Word (`.doc`) document.
*   **Smart Document Downloader**:
    *   Automatically downloads and uploads images within the selected content.
    *   Updates image links in Markdown to point to the uploaded assets.
    *   Supports "Connectivity Check" to ensure reliable downloads.
*   **Configurable Filenames & Paths**:
    *   Customize filename patterns using variables like `PAGE_TITLE` and `TIMESTAMP`.
    *   Set default upload folders.
    *   Dynamic folder creation based on filename paths (e.g., `Folder/Subfolder/Filename`).
*   **Secure Authentication**: Uses pCloud's official OAuth 2.0 flow for secure and seamless login.
*   **Internationalization**: Fully localized for English and Traditional Chinese (繁體中文).

## Installation

1.  Clone this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" in the top right corner.
4.  Click "Load unpacked" and select the repository folder.

## Usage

1.  **Login**: Click the extension icon in the toolbar and log in with your pCloud account.
2.  **Save Content**:
    *   Right-click on an image -> "Save image to pCloud".
    *   Select text -> Right-click -> "Save selection to pCloud".
    *   Select content -> Right-click -> "Save Selection as Document to pCloud".
3.  **Options**: Right-click the extension icon and select "Options" to configure:
    *   Filename formats.
    *   Default upload locations.
    *   Document format preferences (Markdown/Word).

## Development & Packaging

This project includes a `Makefile` to simplify packaging for development and production.

-   **Development Build**:
    ```bash
    make
    # or
    make package
    ```
    Creates an unminified zip file (e.g., `pcloud-chrome-extension-v1.0-dev.zip`) in the root directory.

-   **Production Release**:
    ```bash
    make release
    ```
    Creates a minified, production-ready zip file (e.g., `pcloud-chrome-extension-v1.0.zip`) with optimized CSS and JS resources.

-   **Clean**:
    ```bash
    make clean
    ```
    Removes all build artifacts and zip files.

## Project Structure

See [GEMINI.md](GEMINI.md) for detailed architecture and development guidelines.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.