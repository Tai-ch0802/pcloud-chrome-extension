# 功能規格書：PDF 檢視器整合

## 1. 概述
本功能旨在將 HyperFetch for pCloud 直接整合至 Chrome PDF 檢視器中。它為使用者提供了一種便捷的方式，可以直接將 PDF 檔案儲存至 pCloud 儲存空間，並作為進階功能，將其轉換並儲存為 Markdown 文件。

## 2. 使用者介面

### 2.1 位置
新的控制項將注入至現有的 PDF 檢視器工具列中，具體位於 `<viewer-download-controls id="downloads">` 元素內。

### 2.2 新增控制項
將在原生下載按鈕的左側新增兩個互動元素：

1.  **「下載至 pCloud」按鈕**：
    -   **圖示**：pCloud Logo 或類似的上傳圖示。
    -   **動作**：直接將當前檢視的 PDF 上傳至 pCloud。
    -   **提示文字 (Tooltip)**：「儲存至 pCloud」。

2.  **下拉選單按鈕**：
    -   **圖示**：附著在主按鈕右側的向下小箭頭/V形圖示。
    -   **動作**：切換下拉選單的可見性。

### 2.3 下拉選單
點擊下拉按鈕時，將出現包含以下選項的選單：

-   **「下載為 Markdown 至 pCloud」**：
    -   **狀態**：**進階功能**（應在視覺上加以區分，例如使用皇冠圖示或「PRO」標記）。
    -   **動作**：將 PDF 內容轉換為 Markdown 並將 `.md` 檔案上傳至 pCloud。

## 3. 功能需求

### 3.1 下載至 pCloud（免費）
-   **觸發條件**：點擊主「下載至 pCloud」按鈕。
-   **流程**：
    1.  從檢視器中獲取 PDF 檔案 Blob。
    2.  使用現有的檔案上傳邏輯（遵循預設資料夾設定）。
    3.  顯示上傳進度及成功/錯誤通知（Toast/Snackbar）。

### 3.2 下載為 Markdown（進階）
-   **觸發條件**：點擊下拉選單中的「下載為 Markdown 至 pCloud」。
-   **先決條件**：使用者必須擁有有效的進階版授權。如果沒有，顯示升級提示。
-   **流程**：
    1.  獲取 PDF 檔案 Blob。
    2.  解析 PDF 內容（文字和圖片）。
    3.  將內容轉換為 Markdown 格式。
    4.  將生成的 `.md` 檔案上傳至 pCloud。
    5.  （可選）如果 Markdown 引用了圖片，將提取的圖片上傳至資產資料夾。

## 4. 技術實作

### 4.1 DOM 注入
-   **目標元素**：`<viewer-download-controls id="downloads">`。
-   **Shadow DOM**：Chrome PDF 檢視器通常將其 UI 封裝在 Shadow DOM 中。Content Script 必須能夠遍歷 Shadow DOM 以定位目標元素。
-   **觀察者**：可能需要 `MutationObserver` 來偵測 PDF 檢視器 UI 何時完全載入並準備好進行注入。

### 4.2 PDF 轉 Markdown
-   **函式庫**：需要客戶端函式庫（如用於解析的 `pdf.js` 和自定義轉換器或 `turndown` 適配器）來從 PDF Blob 中提取文字和結構。
-   **複雜度**：PDF 結構各異。轉換器應嘗試保留基本格式（標題、段落、列表）。

### 4.3 權限
-   確保 `manifest.json` 中的 `content_scripts` 配置為在 PDF 頁面上運行，或者擴充功能擁有適當的權限將腳本注入檢視器上下文。

## 5. 未來考量
-   **OCR**：對於掃描的 PDF，未來版本可以整合 OCR 以提取文字進行 Markdown 轉換。
