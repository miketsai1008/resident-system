# 住戶緊急聯絡資料管理系統 - 部署指南

本系統使用 **Google Apps Script (GAS)** 與 **Google Sheets** 建置。請依照以下步驟部署。

## 步驟 1：建立 Google Sheet
1.  登入您的 Google 帳號。
2.  建立一個新的 Google Sheet (試算表)。
3.  將試算表命名為 **「住戶資料管理系統」** (或您喜歡的名稱)。

## 步驟 2：開啟 Apps Script 編輯器
1.  在試算表中，點選上方選單的 **擴充功能 (Extensions)** > **Apps Script**。
2.  這會開啟一個新的專案視窗。

## 步驟 3：複製程式碼
請將本資料夾中的檔案內容，對應複製到 Apps Script 編輯器中：

1.  **Code.gs**:
    - 點選編輯器左側的 `程式碼.gs` (或 `Code.gs`)。
    - 清空內容，將本專案 `resident-system-gas/Code.gs` 的內容完整貼上。

2.  **index.html**:
    - 點選左側 **+** 號 > **HTML**。
    - 命名為 `index` (注意：不用打 .html，系統會自動加)。
    - 將 `resident-system-gas/index.html` 內容貼上。

3.  **css.html**:
    - 點選左側 **+** 號 > **HTML**。
    - 命名為 `css`。
    - 將 `resident-system-gas/css.html` 內容貼上。

4.  **js.html**:
    - 點選左側 **+** 號 > **HTML**。
    - 命名為 `js`。
    - 將 `resident-system-gas/js.html` 內容貼上。

## 步驟 4：初始化資料庫
1.  在 Apps Script 編輯器上方的工具列，找到函式選單 (通常顯示 `myFunction`)。
2.  選擇 **`initialSetup`**。
3.  點選 **執行 (Run)**。
4.  **核對權限**：系統會要求授權，請選擇您的帳號 -> 進階 (Advanced) -> 前往... (Go to...) -> 允許 (Allow)。
5.  執行完畢後，回到您的 Google Sheet，您會看到下方多了 `Residents`, `Admins`, `Logs` 三個分頁，且標題欄位已建立。

## 步驟 5：部署為 Web App
1.  點選編輯器右上角的 **部署 (Deploy)** > **新增部署 (New deployment)**。
2.  左側選擇 **網頁應用程式 (Web app)**。
3.  設定內容：
    - **說明 (Description)**: 住戶系統 v1
    - **執行身分 (Execute as)**: **我 (Me)**  <-- 重要！
    - **誰可以存取 (Who has access)**: **任何人 (Anyone)** <-- 重要！這樣住戶才不用登入 Google 即可填寫。
4.  點選 **部署 (Deploy)**。
5.  複製 **網頁應用程式網址 (Web app URL)**。此網址即為系統入口，請提供給住戶或管理者。

## 系統使用說明

### 住戶端
- 直接開啟網址，輸入戶號即可填寫或更新資料。

### 管理者端
- 在網址首頁點選「管理員登入」。
- **預設帳號**: `ch-admin`
- **預設密碼**: `ch-admin`
- 登入後請務必點選「修改密碼」以確保安全。
