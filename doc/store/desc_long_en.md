# HyperCmdC for pCloud: Comprehensive Feature Breakdown [OPEN SOURCE]

HyperCmdC for pCloud is a sophisticated, **open-source** Google Chrome extension designed to bridge the gap between web browsing and cloud storage. It transforms pCloud from a passive storage locker into an active productivity tool, allowing users to capture, organize, and archive web content with unprecedented ease. All features are now completely **free**.

## Core Value Proposition

For researchers, students, and power users, the traditional workflow of "Right-click Save As -> Find Folder -> Save -> Open pCloud -> Upload" is friction-heavy. HyperCmdC eliminates these steps, creating a direct pipeline from the browser to the cloud.

## Detailed Feature Set

### 1. Context Menu Integration
HyperCmdC embeds deep into the browser's context menu, providing instant access to pCloud wherever you are.

-   **Save Image to pCloud**: Instantly uploads the image under your cursor.
-   **Save Selection**: Highlights text and saves it as a text/markdown file.
-   **Save Selection as Document**: A powerful scraper that takes the selected HTML, including images, and converts it into a standalone document.
    
### 2. Intuitive Drag & Drop
Beyond the context menu, HyperCmdC supports the most natural interaction.
-   **Drag to Upload**: Creating a seamless flow, simply drag any image *from the webpage* directly to the floating overlay to instantly upload it to pCloud.


### 3. Intelligent Asset Management
When saving web content, HyperCmdC doesn't just save text. It acts as an intelligent asset manager:

-   **Automatic Image Handling**: When saving a selection as a document, the extension detects all images within the selection.
-   **Cloud-Side Asset Storage**: Instead of keeping hotlinks (which die) or embedding base64 (which is heavy), it downloads every image, uploads it to a dedicated assets folder in your pCloud, and rewrites the document links to point to your permanent cloud copy.
-   **Connectivity Assurance**: Includes a "ping" check to ensure pCloud connectivity before attempting complex operations.

### 4. PDF Viewer Integration
HyperCmdC injects a seamless, native-feeling UI into standard PDF files viewed in Chrome.

-   **Floating Overlay**: A non-intrusive floating action button (FAB) appears on PDF pages.
-   **Direct Upload**: One click saves the current PDF to your cloud.
-   **PDF to Markdown**：Attempts to convert the PDF into a Markdown note, making it easy to organize, feed into AI models, or use in other applications.

### 5. Advanced Customization & Logic

#### Filename Templating
Users can define exactly how files are named using a block-based builder.
-   **Variables**: `Page Title`, `Timestamp`, `Sorting Number`.
-   **Custom Keys**: Inject constant strings (e.g., project codes) into filenames.
-   **Dynamic Pathing**: Use slashes `/` in rules to dynamically create folder structures based on the date or page title.

#### Domain-Based Routing (Domain Rules)
This is a game-changer for organized hoarders.
-   **Rule Engine**: Users can define wildcard rules (e.g., `*.medium.com/*`, `github.com/docs/*`).
-   **Auto-Sorting**: Content saved from matching domains is automatically routed to specific pCloud folders.
    -   *Example*: All PDFs from `arxiv.org` go to `/Research/Papers`.
    -   *Example*: All images from `pinterest.com` go to `/Inspiration/Design`.

### 6. Technical Architecture
-   **Security**: Built on OAuth 2.0 with the official pCloud API. Tokens are stored securely in `chrome.storage.sync`.
-   **Modern Tech**: Uses React-like state management in Vanilla JS (Shadow DOM) for isolated, conflict-free UI injection.
-   **Performance**: Background Service Workers handle heavy lifting (uploads) to keep the browsing experience snappy.

## Use Cases

1.  **The Academic**: Browsing research papers. Configures a Domain Rule for `jstor.org`. Clicks the PDF overlay button. The paper is instantly filed in `/University/Thesis/References`.
2.  **The Designer**: Collecting mood board assets. Right-clicks images across the web. All are auto-saved to `/Assets/Inspiration` without ever opening a file dialog.
3.  **The Writer**: Researching an article. Highlights paragraphs of text. Saves them as Markdown. They appear in pCloud, ready to be opened in Obsidian or any Markdown editor on their phone or tablet.

HyperCmdC for pCloud isn't just an uploader; it's your web-to-cloud productivity engine.
