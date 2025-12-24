# 目錄結構

本專案的架構設計旨在實現可擴展性、可維護性，並為未來的營利做好準備。

```
/
├── doc/
│   └── feat-spec/      # 功能規格文件
├── _locales/
│   ├── en/
│   │   └── messages.json # 英文語系字串
│   └── zh_TW/
│       └── messages.json # 繁體中文語系字串
├── src/
│   ├── core/             # 核心邏輯、API 客戶端、共用工具
│   ├── features/
│   │   ├── free/         # 免費功能模組 (如：登入、上傳)
│   │   └── paid/         # 付費/進階功能模組
│   ├── background/       # 背景服務工作者腳本 (Service Worker)
│   ├── popup/            # 擴充功能彈出視窗的 UI/邏輯
│   ├── options/          # 擴充功能選項頁面的 UI/邏輯
│   │   ├── sections/     # 模組化的功能區塊 (如：外觀、上傳)
│   │   └── shared/       # 選項頁面的共用工具
│   └── assets/           # 靜態資產，如圖示、CSS、字型
├── manifest.json         # 擴充功能的資訊清單檔案
└── ...
```

- **`_locales/`**: 處理國際化 (i18n)。每個子目錄（例如 `en`、`zh_TW`）都包含用於特定語言字串的 `messages.json` 檔案。
- **`src/core/`**: 包含跨多個功能使用的共用邏輯，例如 pCloud API 客戶端、驗證處理程式和工具函式。
- **`src/features/`**: 這是擴充功能的核心功能，依營利策略清楚區分。
- **`src/background/`**: 用於 Service Worker，處理背景任務，如監聽瀏覽器事件或管理長時間運行的程序。
- **`src/popup/`**: 包含點擊擴充功能圖示時出現的主要使用者介面的 HTML、CSS 和 JavaScript。
