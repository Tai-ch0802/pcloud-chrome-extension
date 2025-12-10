# 功能規格書：付費系統 (PayPal Checkout 整合)

## 1. 概述 (Overview)
本功能旨在為 HyperCmdC 擴充功能引入付費機制。透過整合 **PayPal Checkout (Standard)**，提供兩種付費方案供使用者選擇。系統將利用使用者的 **pCloud Email** 作為身份識別，以實現跨裝置的「恢復購買」功能。

## 2. 目標 (Goals)
*   **多樣化方案**：提供單一產品授權與全系列產品授權兩種選擇。
*   **全球化支付**：支援 PayPal 帳戶與信用卡支付。
*   **帳號綁定**：將付費授權與使用者的 pCloud Email 綁定。
*   **無縫體驗**：在擴充功能選項頁面 (Options Page) 直接完成購買流程。

## 3. 產品方案 (Product Tiers)

| 方案名稱 | 價格 (USD) | 代碼 (`productType`) | 說明 | PayPal Client ID |
| :--- | :--- | :--- | :--- | :--- |
| **HyperCmdC for pCloud** | $1.99 | `hf4pcloud` | 僅解鎖本擴充功能 (pCloud) 的進階功能。 | Credential A |
| **HyperCmdC Master** | $5.00 | `hf4master` | 解鎖本擴充功能及未來所有 HyperCmdC 系列產品 (如 S3 版本)。 | Credential B |

> **注意**：使用者可在介面上切換選擇方案。由於兩個方案使用不同的 PayPal Client ID，切換時需動態重新載入 PayPal SDK。

## 4. 系統架構與設計 (Architecture & Design)

### 4.1. 核心流程 (Core Flows)

#### A. 購買流程 (Purchase Flow)
1.  **初始化**：
    *   使用者進入選項頁面，選擇欲購買的方案 (預設為 `hf4pcloud`)。
    *   擴充功能根據選擇的方案，載入對應的 PayPal SDK (使用對應的 Client ID)。
    *   擴充功能呼叫 pCloud API 取得當前登入者的 **Email**。
2.  **付款**：
    *   使用者點擊 PayPal 按鈕並完成付款。
3.  **驗證與綁定 (Verification & Binding)**：
    *   PayPal SDK 回傳 `orderID`。
    *   擴充功能將以下資訊發送至後端驗證 API：
        *   `orderId`: PayPal 訂單編號
        *   `email`: pCloud 使用者 Email
        *   `productType`: `hf4pcloud` 或 `hf4master`
    *   後端驗證成功後，回傳簽署過的 **License Key** 與授權資訊。
4.  **啟用**：
    *   擴充功能將 License 儲存於 `chrome.storage.sync`。
    *   解鎖對應的進階功能。

#### B. 恢復購買流程 (Restore Purchase Flow)
1.  **觸發**：使用者點擊「恢復購買」。
2.  **查詢**：擴充功能將 `Email` 發送至後端查詢 API。
3.  **恢復**：後端回傳該 Email 擁有的最高權限 License (若有)。

### 4.2. 資料模型 (Data Model)

#### License Object (Stored in `chrome.storage.sync`)
```json
{
  "status": "premium", // 或 "master"
  "productType": "hf4pcloud", // 或 "hf4master"
  "key": "hf_v1_eyJhbGciOiJIUzI1NiIsIn...",
  "email": "user@example.com",
  "purchaseDate": "2024-11-25T14:00:00Z",
  "orderId": "PAYPAL-ORDER-ID-123"
}
```

*   **`status`**:
    *   `premium`: 對應 `hf4pcloud`，僅解鎖當前產品。
    *   `master`: 對應 `hf4master`，解鎖全系列產品。

### 4.3. 開發設定 (Dev Configuration)
*   **Sandbox Client ID (Default)**: `ASIxhJYAlMUVAvBcQGtXSP5fsH9caU6n6zfWneS36yXTPIEajc99yzCwHA2VqbinPgikHvfJ0xLkv0Sv`
*   *註：開發階段暫時使用同一組 Sandbox ID 測試兩種方案，正式環境將區分。*

## 5. 後端架構 (Backend Architecture)
*   **平台**: Cloudflare Workers
*   **資料庫**: Cloudflare D1 (SQL)
*   **詳情**: 請參閱 `doc/feat-spec/007-1-backend-api-for-payment-system.md`。
