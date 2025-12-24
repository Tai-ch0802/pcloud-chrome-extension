# 建置與發布工作流程

我們使用 `make` 來管理建置與打包流程。這能確保建置的一致性，並讓原始碼控制更整潔。

### Makefile 目標 (Targets)

*   **`make` / `make package` (開發用)**：
    *   建立 `build-dev` 目錄。
    *   複製 `src`、`_locales` 和 `manifest.json`。
    *   將內容壓縮為 `pcloud-chrome-extension-vX.X-dev.zip`。
    *   **不執行**最小化 (Minification)。此模式用於測試本機變更。

*   **`make release` (生產用)**：
    *   建立 `build-prod` 目錄。
    *   複製原始碼檔案。
    *   使用 `esbuild` 對所有 `.js` 和 `.css` 檔案進行**就地最小化 (Minifies)**。
    *   將內容壓縮為 `pcloud-chrome-extension-vX.X.zip`。
    *   使用此 zip 檔案上傳至 Chrome 線上應用程式商店 (Chrome Web Store)。

*   **`make clean`**：
    *   移除 `build-dev`、`build-prod` 目錄以及所有 `*.zip` 檔案。
