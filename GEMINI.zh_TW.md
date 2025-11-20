# 專案架構與指南

本文件概述了 pCloud Chrome 擴充功能套件的架構、其核心原則以及給予 Gemini 的特別指示。

## 1. 目錄結構

專案的組織結構旨在實現可擴展性、可維護性，並為未來的商業化做好準備。

```
/
├── doc/
│   └── feat-spec/      # 功能規格文件
├── _locales/
│   ├── en/
│   │   └── messages.json # 英語語言字串
│   └── zh_TW/
│       └── messages.json # 繁體中文字串
├── src/
│   ├── core/             # 核心邏輯、API 客戶端、共享工具程式
│   ├── features/
│   │   ├── free/         # 免費功能模組 (例如：登入、上傳)
│   │   └── paid/         # 付費/高級功能模組
│   ├── background/       # 背景 Service Worker 腳本
│   ├── popup/            # 擴充功能彈出視窗的 UI 與邏輯
│   ├── options/          # 擴充功能選項頁面的 UI 與邏輯
│   └── assets/           # 圖示、CSS、字體等靜態資源
├── manifest.json         # 擴充功能的清單檔
└── ...
```

- **`_locales/`**: 處理國際化 (i18n)。每個子目錄（如 `en`, `zh_TW`）都包含一個用於特定語言字串的 `messages.json` 檔案。
- **`src/core/`**: 包含跨多個功能使用的共享邏輯，例如 pCloud API 客戶端、身份驗證處理器和工具函數。
- **`src/features/`**: 這是擴充功能的核心，並根據商業化策略進行了明確分離。
- **`src/background/`**: 用於 Service Worker，它處理背景任務，如監聽瀏覽器事件或管理長時間運行的進程。
- **`src/popup/`**: 包含點擊擴充功能圖示時出現的主要使用者介面的 HTML、CSS 和 JavaScript。

## 2. 商業化策略

將 `src/features/free/` 和 `src/features/paid/` 分開是刻意為之的。這種結構帶來以下好處：
1.  **清晰的代碼組織**：開發人員可以輕鬆區分免費和高級功能。
2.  **靈活的建置流程**：我們可以設定建置腳本（例如使用 Webpack 或 Rollup）來創建不同的擴充功能套件包：
    - 一個**免費版本**，僅包含 `free/` 目錄中的模組。
    - 一個**高級版本**，包含 `free/` 和 `paid/` 目錄中的模組。

## 3. 國際化 (i18n)

所有面向使用者的字串都必須通過 `_locales` 系統進行管理。
- **不要在 HTML 或 JavaScript 檔案中硬編碼文字**。
- 在 `messages.json` 中使用鍵 (key)，並使用 `chrome.i18n.getMessage("keyName")` API 來檢索它們。
- 這確保了新增一種語言就像建立一個新的 `[lang]/messages.json` 檔案一樣簡單。

## 4. 重要參考資料

- **pCloud API 官方文件:** [https://docs.pcloud.com/](https://docs.pcloud.com/)
- **pCloud JS SDK (供參考):** [https://github.com/pCloud/pcloud-sdk-js](https://github.com/pCloud/pcloud-sdk-js)

---

## 5. 上下文工程 (Context Engineering)

為了確保 session 的連續性和有效的上下文管理，Gemini 在啟動新 session 時將遵循以下流程：

1.  **主要指令**：閱讀並理解這份 `GEMINI.md` 檔案的全部內容。
2.  **Session 回溯**：閱讀並理解 `.gemini/` 目錄下最新的 session 筆記（例如 `NOTE_YYYYMMDD.md`）。這份筆記提供了關於專案最新狀態和已完成任務的上下文。

---

## 6. Commit Message Guidelines (提交訊息指南)

We follow the Conventional Commits specification.

**Format:**
```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation

**Example:**
```
feat: Implement Document Downloader and update project guidelines

This commit introduces a new feature allowing users to save selected web content as Markdown or Word documents to pCloud.

Key Features & Changes:
1.  **Document Downloader:** Implemented `contextMenuDocumentDownloader.js`.
2.  **Cleanup:** Removed unused PDF dependencies.
```

---

## 給 Gemini 的特別指示

When communicating with the user, always use **Traditional Chinese (繁體中文)**. However, during the **reasoning and chain-of-thought** process, you MUST use **English**. This ensures that the quality of logic and reasoning is not compromised by language translation nuances.
