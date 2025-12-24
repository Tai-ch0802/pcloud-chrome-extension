# 國際化 (i18n)

所有呈現給使用者的字串都必須透過 `_locales` 系統管理。
- **請勿將文字硬編碼**在 HTML 或 JavaScript 檔案中。
- 在 `messages.json` 中使用鍵值，並透過 `chrome.i18n.getMessage("keyName")` API 取得它們。
- 這能確保新增語言就像建立一個新的 `[lang]/messages.json` 檔案一樣簡單。
