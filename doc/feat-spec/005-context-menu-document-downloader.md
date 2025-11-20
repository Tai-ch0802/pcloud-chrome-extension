# 功能規格書：右鍵選單文件下載器

## 1. 概述
本功能的目標是建立一個新的模組 `contextMenuDocumentDownloader.js`，將現有的圖片下載與文字上傳功能結合。此功能將允許使用者選取網頁內容（包含文字與圖片），將其轉換為結構化的格式（Markdown 或 DOC），並上傳至 pCloud。
**注意：此功能將被歸類為付費功能 (Paid Feature)，位於 `src/features/paid/`。**

## 2. 使用者故事 (User Stories)
- 作為使用者，我想要選取網頁的一部分（包含文字和圖片）並將其儲存到我的 pCloud。
- 作為使用者，我想要選擇儲存文件的格式（.md、.doc）。
- 作為使用者，我想要自訂儲存文件的檔案名稱。
- 作為使用者，我想要選擇性地在儲存的 Markdown 檔案中包含 Metadata（時間戳記、來源 URL 等），以便未來用於 RAG（檢索增強生成）等用途。

## 3. 使用者介面變更

### 3.1 右鍵選單 (Context Menu)
- **新增項目**: "Save Selection as Document to pCloud" (需支援 i18n，例如繁體中文顯示「將選取內容儲存為文件至 pCloud」)。
- **觸發情境 (Context)**: `selection` (選取狀態)。

### 3.2 選項頁面 (Options Page)
將新增一個區塊 (Card) 用於「文件下載器」的設定。

#### 3.2.1 檔案名稱設定
- 與現有的圖片/文字檔案名稱設定類似。
- 提供拖放介面以重新排序檔案名稱組成部分：
    - `PAGE_TITLE` (網頁標題)
    - `TIMESTAMP` (時間戳記)
    - `SORTING_NUMBER` (排序編號 - 雖然對文件來說可能較少用，但保持一致性)

#### 3.2.2 檔案格式選擇
- 下拉式選單或單選按鈕以選擇預設格式：
    - Markdown (`.md`) - *預設值*
    - Word (`.doc`)

#### 3.2.3 Metadata 切換 (僅限 Markdown)
- 核取方塊："Include Metadata (YAML Frontmatter)" (包含 Metadata)。
- 僅在選擇 Markdown 格式時有效。
- **Metadata 欄位**:
    - `source_url`: 網頁的原始 URL。
    - `captured_at`: 擷取時間戳記。
    - `title`: 網頁標題。

## 4. 技術實作

### 4.1 核心邏輯 (`contextMenuDocumentDownloader.js`)
- **進入點**: `chrome.contextMenus.onClicked` 監聽器。
- **連線檢查 (Connectivity Check)**:
    - 在執行任何操作前，先發送 `ping` 訊息至 Content Script。
    - 若連線失敗（例如擴充功能重載後頁面未刷新），顯示明確的錯誤訊息提醒使用者刷新頁面。
- **內容擷取**:
    - 發送訊息至 Content Script (`getSelectionData`)。
    - Content Script 複製選取的 DOM 內容，將相對 URL（圖片、連結）解析為絕對 URL。
    - 回傳 HTML 字串與初步轉換的 Markdown。

### 4.2 內容處理
- **Markdown 轉換**:
    - 使用 `turndown` 函式庫將 HTML 轉換為 Markdown。
    - **圖片處理**:
        - **流程**: 解析 Markdown -> 辨識圖片 -> 下載圖片 -> 上傳圖片至 pCloud -> 替換圖片連結。
        - **路徑**: 圖片將上傳至與文件相關聯的子資料夾 (命名規則：`assets_{doc_name}`)，Markdown 中使用相對路徑引用。
    - **後處理 (Post-processing)**:
        - **移除連結外殼**: 自動移除被 `<a>` 標籤包覆的圖片連結 (`[![]()](url)` -> `![]()`)，避免 Markdown 格式混亂。
        - **清理排版**: 縮減過多的換行符號。
- **DOC 轉換**:
    - 使用 `html-docx-js` 函式庫（於 Content Script 中執行）將 HTML 轉換為 DOCX Blob。
    - 圖片需先轉換為 Base64 並嵌入 HTML 中，再進行轉換。

### 4.3 進度回饋與 UI 互動
- **通知 (Notifications)**:
    - **處理中**: 顯示 "Processing Document..."。
    - **成功**: 顯示 "Document Saved"。
    - **失敗**: 顯示具體的錯誤原因（如認證失敗、連線中斷）。

### 4.4 儲存 / 設定
- **Storage Keys**:
    - `doc_filename_config`: 設定物件陣列。
    - `doc_format`: 字串 (`md`, `doc`)。
    - `doc_include_metadata`: 布林值。

## 5. 待確認問題 / 考量點
- **圖片上傳**: 上傳多張圖片 + 文件本身可能需要時間。目前使用 `initiateUpload` 統一處理上傳進度。
- **權限**: 需要 `activeTab` 或 Host 權限以注入 Script 進行內容擷取。

## 6. 預計變更檔案
- `[NEW] src/features/paid/contextMenuDocumentDownloader.js`
- `[MODIFY] src/background/service-worker.js` (初始化新的下載器)
- `[MODIFY] src/options/options.html` (UI 更新)
- `[MODIFY] src/options/options.js` (邏輯更新)
- `[MODIFY] src/content/content.js` (增強選取內容擷取與 DOC 生成)
- `[MODIFY] _locales/en/messages.json` & `_locales/zh_TW/messages.json` (新增 i18n 字串)
