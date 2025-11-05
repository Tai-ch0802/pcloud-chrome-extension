# Project Architecture and Guidelines

This document outlines the architecture for the pCloud Chrome Extension, its core principles, and special instructions for Gemini.

## 1. Directory Structure

The project is organized to be scalable, maintainable, and ready for future monetization.

```
/
├── doc/
│   └── feat-spec/      # Feature specification documents
├── _locales/
│   ├── en/
│   │   └── messages.json # English language strings
│   └── zh_TW/
│       └── messages.json # Traditional Chinese strings
├── src/
│   ├── core/             # Core logic, API clients, shared utilities
│   ├── features/
│   │   ├── free/         # Modules for free features (e.g., login, upload)
│   │   └── paid/         # Modules for paid/premium features
│   ├── background/       # Background service worker scripts
│   ├── popup/            # UI/logic for the extension's popup
│   ├── options/          # UI/logic for the extension's options page
│   └── assets/           # Static assets like icons, CSS, fonts
├── manifest.json         # The extension's manifest file
└── ...
```

- **`_locales/`**: Handles internationalization (i18n). Each sub-directory (e.g., `en`, `zh_TW`) contains a `messages.json` file for language-specific strings.
- **`src/core/`**: Contains shared logic that is used across multiple features, such as the pCloud API client, authentication handlers, and utility functions.
- **`src/features/`**: This is the heart of the extension's functionality, clearly separated by monetization strategy.
- **`src/background/`**: For the service worker, which handles background tasks like listening for browser events or managing long-running processes.
- **`src/popup/`**: Contains the HTML, CSS, and JavaScript for the main user interface that appears when the extension icon is clicked.

## 2. Monetization Strategy

The separation of `src/features/free/` and `src/features/paid/` is intentional. This structure allows for:
1.  **Clear Code Organization**: Developers can easily distinguish between free and premium functionality.
2.  **Flexible Builds**: We can set up build scripts (e.g., using Webpack or Rollup) to create different extension packages:
    - A **free version** that only includes modules from the `free/` directory.
    - A **premium version** that includes modules from both `free/` and `paid/` directories.

## 3. Internationalization (i18n)

All user-facing strings must be managed through the `_locales` system.
- **Do not hardcode text** in HTML or JavaScript files.
- Use keys in `messages.json` and retrieve them using the `chrome.i18n.getMessage("keyName")` API.
- This ensures that adding a new language is as simple as creating a new `[lang]/messages.json` file.

## 4. Key References

- **pCloud API Documentation:** [https://docs.pcloud.com/](https://docs.pcloud.com/)
- **pCloud JS SDK (for reference):** [https://github.com/pCloud/pcloud-sdk-js](https://github.com/pCloud/pcloud-sdk-js)

---

## 5. Context Engineering

To ensure session continuity and effective context management, Gemini will adhere to the following process upon starting a new session:

1.  **Primary Directives**: Read and understand the entirety of this `GEMINI.md` file.
2.  **Session Recall**: Read and understand the most recent session note, found in the `.gemini/` directory (e.g., `NOTE_YYYYMMDD.md`). This provides context on the latest state of the project and completed tasks.

---

## Special Instruction for Gemini

When GEMINI receives a task request, it should use English for its chain of thought and reasoning process. The final response delivered to the end-user must be in Traditional Chinese.
