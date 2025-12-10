# 功能規格書：後端 API (Cloudflare Workers + D1) + 外部付款頁面

## 1. 概述 (Overview)
本文件定義了 HyperCmdC 付費系統的後端架構與 API 介面。系統由以下組件構成：
- **擴充功能 (Extension)**：引導用戶到外部付款頁面
- **付款頁面 (Payment Page)**：託管於 Cloudflare Pages（或其他靜態主機），集成 PayPal SDK
- **後端 API (Backend API)**：部署於 **Cloudflare Workers**，使用 **Cloudflare D1** (SQLite) 作為資料庫

> **重要變更**：由於 Chrome Extension Manifest V3 的 CSP 限制，PayPal SDK 無法直接在擴充功能中使用。因此採用外部付款頁面的架構。

## 2. 架構 (Architecture)

### 2.1. 系統組件

```
[Extension] --> Opens Tab --> [Payment Page (Cloudflare Pages)]
                                     |
                                     | PayPal Checkout
                                     v
                              [PayPal API]
                                     |
                                     | Webhook/Direct Call
                                     v
                              [Backend API (Workers)]
                                     |
                                     v
                              [D1 Database]
                                     |
[Extension] <-- Restore Purchase <--+
```

### 2.2. 技術棧

*   **Extension**: Chrome Extension (Manifest V3)
*   **Payment Page**: 靜態 HTML/JS 頁面，託管於 Cloudflare Pages
    *   集成 PayPal Checkout SDK
    *   可用 URL 參數傳遞 `tier` 和 `email`
*   **Backend API**: Cloudflare Workers (Serverless)
*   **Database**: Cloudflare D1 (SQLite)

### 2.3. 付款流程 (Payment Flow)

1. **用戶在 Extension 中點擊「升級」**
   - Extension 獲取用戶的 pCloud Email
   - 開啟新分頁到付款頁面：`https://hyper-cmdc.taislife.work/payment?tier=hf4pcloud&email=user@example.com`

   **範例 Request:**
   ```http
   GET https://hyper-cmdc.taislife.work/payment?tier=hf4pcloud&email=test@example.com
   ```

2. **付款頁面顯示定價與 PayPal 按鈕**
   - 根據 URL 參數 `tier` 顯示對應價格
   - 集成 PayPal SDK（無 CSP 限制）
   - 用戶完成付款

3. **PayPal 訂單完成後**
   - 付款頁面調用後端 API：`POST /api/verify`
   - 後端驗證 PayPal 訂單並生成授權
   - 付款頁面顯示成功訊息，引導用戶回到 Extension

4. **用戶在 Extension 中點擊「恢復購買」**
   - Extension 調用：`POST /api/restore`
   - 後端根據 Email 查詢授權
   - 授權資訊同步到 `chrome.storage.sync`

### 3. 付款成功處理 (Frontend)

1.  使用者在 PayPal 完成付款。
2.  PayPal 重導向回 `return_url` (即 `https://hyper-cmdc.taislife.work/payment/success`)。
3.  前端頁面 (`payment/success`) 顯示 "Payment Successful" 訊息。
4.  (Optional) 前端頁面嘗試透過 `window.opener.postMessage` 通知擴充功能 (如果是由擴充功能開啟的 popup)。
    *   **更好作法：** 擴充功能 Options 頁面本身就在輪詢 (Polling) License API，或者提供 "Refresh Status" 按鈕。
5.  使用者關閉付款分頁，回到擴充功能 Options 頁面。

## 3. 資料庫設計 (Database Schema)

### Table: `licenses`
儲存所有已發出的授權紀錄。

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key, Auto Increment |
| `email` | TEXT | pCloud User Email (Unique Index) |
| `order_id` | TEXT | PayPal Order ID (Unique) |
| `product_type` | TEXT | `hf4pcloud` or `hf4master` |
| `status` | TEXT | `premium` or `master` |
| `license_key` | TEXT | Generated License Key (JWT or UUID) |
| `created_at` | DATETIME | Purchase Timestamp |
| `updated_at` | DATETIME | Last Update Timestamp |

```sql
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL,
  status TEXT NOT NULL,
  license_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 4. API 介面 (API Endpoints)

### 4.1. 驗證購買 (Verify Purchase)
*   **Endpoint**: `POST /api/verify`
*   **Description**: 接收前端傳來的 PayPal 訂單資訊，驗證後建立或更新授權紀錄。
*   **Request Body**:
    ```json
    {
      "orderId": "PAYPAL-ORDER-ID",
      "email": "user@example.com",
      "productType": "hf4pcloud" // or "hf4master"
    }
    ```
*   **Logic**:
    1.  呼叫 PayPal API (`v2/checkout/orders/{orderId}`) 驗證訂單狀態是否為 `COMPLETED`。
    2.  檢查資料庫中是否已存在該 `email`。
        *   若存在且 `productType` 為 `hf4master`，則保留最高權限。
        *   若不存在，建立新紀錄。
    3.  生成 `licenseKey`。
    4.  寫入/更新 D1 資料庫。
    5.  回傳授權資訊。
*   **Response (Success)**:
    ```json
    {
      "success": true,
      "license": {
        "status": "premium",
        "productType": "hf4pcloud",
        "key": "GENERATED_LICENSE_KEY",
        "email": "user@example.com"
      }
    }
    ```

### 4.2. 恢復購買 (Restore Purchase)
*   **Endpoint**: `POST /api/restore`
*   **Description**: 根據 Email 查詢現有的授權。
*   **Request Body**:
    ```json
    {
      "email": "user@example.com"
    }
    ```
*   **Logic**:
    1.  查詢 D1 資料庫 `SELECT * FROM licenses WHERE email = ?`.
    2.  若無紀錄，回傳錯誤或空狀態。
    3.  若有紀錄，回傳該授權資訊。
*   **Response (Success)**:
    ```json
    {
      "success": true,
      "license": {
        "status": "master",
        "productType": "hf4master",
        "key": "EXISTING_LICENSE_KEY",
        "email": "user@example.com"
      }
    }
    ```
*   **Response (Not Found)**:
    ```json
    {
      "success": false,
      "error": "No license found for this email."
    }
    ```

## 5. 付款頁面 (Payment Page) 規格

### 5.1. URL 結構
```
https://payment.hyperfetch.com/checkout?tier={TIER}&email={EMAIL}
```

參數說明：
- `tier`: `hf4pcloud` 或 `hf4master`
- `email`: 用戶的 pCloud Email（用於綁定授權）

### 5.2. 頁面功能
1. **顯示方案資訊**
   - 根據 `tier` 參數顯示對應價格和說明
   - 預填 Email（不可編輯）

2. **PayPal 整合**
   - 使用 PayPal Checkout SDK
   - 創建訂單時使用對應的金額和描述
   - 訂單完成後調用後端 API 驗證

3. **成功處理**
   - 顯示成功訊息
   - 提示用戶返回 Extension 並點擊「恢復購買」

### 5.3. Mock 實作（開發階段）
在正式付款頁面部署前，Extension 將：
- 開啟新分頁到 Mock URL：`about:blank` 或本地 HTML 檔案
- 顯示「付款頁面開發中」訊息
- 提供測試用的「模擬購買成功」按鈕

## 6. 安全性考量 (Security Considerations)
*   **PayPal Credentials**: Client Secret 必須儲存在 Cloudflare Workers 的 Environment Variables (Secrets) 中，絕不可暴露於前端代碼。
*   **Rate Limiting**: 針對 API 實施速率限制，防止濫用。
*   **CORS**: 後端 API 需正確配置 CORS，僅允許來自付款頁面域名的請求。
*   **Email 驗證**: 確保 Email 參數的合法性（格式驗證）。

## 7. 開發階段規劃

### Phase 1: Extension Mock Integration（當前）
- [x] 更新 Extension Options UI
- [x] 實作 Mock 付款頁面跳轉
- [x] 實作「恢復購買」功能（使用 Mock 後端）
- [ ] 移除所有 sandbox/iframe 相關代碼

### Phase 2: Backend API Development
- [ ] 設定 Cloudflare Workers 專案
- [ ] 建立 D1 資料庫和 Schema
- [ ] 實作 `/api/verify` 端點
- [ ] 實作 `/api/restore` 端點
- [ ] 整合 PayPal REST API 驗證

### Phase 3: Payment Page Development
- [ ] 建立付款頁面（靜態 HTML/JS）
- [ ] 整合 PayPal Checkout SDK
- [ ] 實作 URL 參數解析
- [ ] 部署到 Cloudflare Pages

### Phase 4: Integration Testing
- [ ] 端到端測試完整付款流程
- [ ] 測試跨裝置恢復購買
- [ ] 處理邊界情況（重複購買、升級等）
