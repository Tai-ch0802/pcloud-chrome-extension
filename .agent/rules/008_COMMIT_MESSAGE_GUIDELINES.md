# 提交訊息指南 (Commit Message Guidelines)

我們遵循 Conventional Commits 規範。

**格式：**
```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

**類型 (Types)：**
- `feat`: 新功能
- `fix`: 錯誤修復
- `docs`: 僅文件變更
- `style`: 不影響程式碼意義的變更（空白、格式化等）
- `refactor`: 既不是修復錯誤也不是增加功能的程式碼變更
- `perf`: 改進效能的程式碼變更
- `test`: 新增缺失的測試或修正現有的測試
- `chore`: 建置過程或輔助工具與函式庫的變更，例如文件生成

**範例：**
```
feat: 實作文件下載器並更新專案指南

此提交引入了一項新功能，允許使用者將選取的網頁內容儲存為 Markdown 或 Word 文件至 pCloud。

關鍵功能與變更：
1.  **文件下載器：** 實作 `contextMenuDocumentDownloader.js`。
2.  **清理：** 移除未使用的 PDF 相依性。
```
