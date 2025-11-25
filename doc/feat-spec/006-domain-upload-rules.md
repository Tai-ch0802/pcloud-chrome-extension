# 功能規格：006 - 透過 Domain 指定上傳路徑

## 1. 功能標題
透過 Domain 指定上傳路徑 (Domain-based Upload Path Rules)

## 2. 描述
此功能允許使用者定義規則，根據來源 URL 的網域 (Domain) 自動將上傳的檔案路由至特定的 pCloud 資料夾。這適用於右鍵選單下載以及可取得來源 URL 的拖曳上傳。這是一個「免費」層級的功能。

## 3. 前置條件
- 使用者必須已登入。
- 上傳的檔案必須具有來源 URL（例如網頁上的圖片）。

## 4. UI/UX
- **位置**：**選項頁面 (Options Page)** 的新區塊，位於現有的「上傳設定」下方。
- **區塊標題**：「透過 domain 指定上傳路徑」。
- **區塊操作區 (右上角)**：
    - **測試匹配 (Test Playground)**：一個摺疊或彈出的區域，提供輸入框讓使用者貼上 URL，即時顯示匹配結果。
    - **新增規則**：按鈕，開啟對話框以建立新規則。
- **介面**：
    - **規則表格**：顯示現有的規則，支援 **拖曳排序 (Drag & Drop)** 以調整優先級。
        - **標題旁說明**：標題旁增加一個 `?` 圖示按鈕。點擊後顯示說明對話框，解釋規則優先級（由上而下）並引導使用者使用「測試匹配」功能。
        - 第一欄：**啟用/停用 (Toggle Switch)**。
        - 第二欄：「domain (支援萬用字元)」。
        - 第三欄：「pcloud 指定上傳路徑」。
        - 第四欄：**操作** (編輯圖示、刪除圖示)。
- **對話框**：
    - **規則編輯器**：
        - **網域樣式**輸入框。
        - **目標路徑**輸入框，右側附帶 **資料夾選擇器 (Folder Picker)** 按鈕。
            - 點擊後開啟 pCloud 資料夾樹狀結構供選擇。
            - **支援建立資料夾**：在選擇器內提供「建立新資料夾」功能，方便使用者直接建立目標路徑。
    - **刪除確認**：刪除規則前出現的確認對話框。
    - **說明指引**：解釋優先級與測試功能的說明對話框。

## 5. 技術細節
- **儲存**：規則儲存於 `chrome.storage.sync`（例如鍵值 `domain_upload_rules`）。
    - 結構：物件陣列 `{ id: string, enabled: boolean, domainPattern: string, targetPath: string }`。
    - **順序**：陣列中的順序即為優先級順序（Index 0 為最高優先級）。
- **比對邏輯**：
    - 當啟動上傳時，依序遍歷規則陣列。
    - 跳過 `enabled: false` 的規則。
    - 比對 `pageUrl` 或 `srcUrl` 是否符合 `domainPattern`。
    - **萬用字元支援**：網域樣式支援 `*` 作為萬用字元。
    - **優先順序**：採用 **First Match** 策略，即第一個匹配的有效規則生效。
- **資料夾建立**：
    - 如果規則中定義的目標路徑在 pCloud 中不存在，擴充功能必須在上傳前自動建立該資料夾結構。
- **資料夾選擇器**：
    - 需呼叫 pCloud API (`listfolder`) 獲取目錄結構。
    - 需處理非同步載入（Lazy Loading）以優化效能。
    - 需呼叫 pCloud API (`createfolder`) 實作建立資料夾功能。

## 6. 國際化 (i18n) 鍵值
- `options_domain_rules_title`: "透過 domain 指定上傳路徑"
- `options_domain_rules_test_playground_title`: "測試匹配"
- `options_domain_rules_test_placeholder`: "輸入網址以測試規則..."
- `options_domain_rules_test_result_match`: "✅ 匹配規則：{rule}"
- `options_domain_rules_test_result_no_match`: "⚠️ 無匹配規則"
- `options_domain_rules_help_icon_tooltip`: "規則說明"
- `options_domain_rules_help_dialog_title`: "規則優先級說明"
- `options_domain_rules_help_dialog_content`: "規則由上而下進行比對，第一個符合的規則將被採用。您可以拖曳調整順序。建議使用上方的「測試匹配」來驗證您的設定。"
- `options_domain_rules_add_button`: "新增規則"
- `options_domain_rules_delete_button`: "刪除規則"
- `options_domain_rules_col_domain`: "domain (支援萬用字元)"
- `options_domain_rules_col_path`: "pcloud 指定上傳路徑"
- `options_domain_rules_dialog_title_add`: "新增規則"
- `options_domain_rules_dialog_title_edit`: "編輯規則"
- `options_domain_rules_folder_picker_create_btn`: "建立新資料夾"
- `options_domain_rules_confirm_delete`: "您確定要刪除此規則嗎？"
