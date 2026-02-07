# 住戶資料管理系統 (Resident Data Management System)

這是一個專為社區設計的住戶資料管理系統，採用 **前後端分離 (Headless Architecture)** 架構。前端介面託管於 GitHub Pages，後端邏輯與資料庫則由 Google Apps Script (GAS) 與 Google Sheets 驅動。

## 🚀 系統特色

### 🏠 住戶端 (Frontend)
- **資料填寫與更新**：住戶可輸入「戶號」登入，系統自動判斷是新增資料或更新現有資料。
- **車位管理**：支援汽車位 (包含車牌、出租資訊) 與機車位的登記。
- **響應式設計**：支援手機與電腦瀏覽，介面簡潔直覺。

### 🛡️ 管理端 (Admin Dashboard)
- **安全登入**：管理員需輸入帳號密碼才能存取後台。
- **權限分級 (RBAC)**：
    - **讀寫權限 (RW)**：擁有完整功能，包含修改/刪除住戶資料、新增/管理管理員帳號。
    - **唯讀權限 (RO)**：僅能查詢與瀏覽住戶資料，無法進行任何修改或刪除操作，亦無法進入管理員設定。
- **資料檢索**：
    - **快速搜尋**：支援搜尋戶號、姓名、電話、車牌號碼等多欄位。
    - **進階排序**：可針對戶號、汽車位、機車位進行排序。
    - **篩選功能**：可依棟別 (A/B) 快速篩選。
- **即時狀態**：顯示資料載入中動畫與搜尋結果筆數。

## 🛠️ 技術架構

- **前端 (Frontend)**：
    - Vue.js 3 (Composition API)
    - Vanilla CSS (RWD Design)
    - GitHub Pages (Hosting)
- **後端 (Backend)**：
    - Google Apps Script (API Service)
    - Google Sheets (Database)

## 📂 專案結構

```
resident-system-gas/
├── .github/workflows/   # GitHub Actions 自動部署設定
├── css/                 # 樣式表 (style.css)
├── js/                  # 前端邏輯 (main.js)
├── index.html           # 主頁面
├── Code.gs              # Google Apps Script 後端程式碼
└── README.md            # 專案說明文件
```

## ⚙️ 安裝與部署

### 1. 後端部署 (Google Apps Script)
1. 將 `Code.gs` 的內容複製到 Google Apps Script 專案中。
2. 首次執行需手動執行 `initialSetup` 函式以建立資料表 (Residents, Admins)。
3. 點擊「部署」 -> 「新增部署」 -> 類型選擇「網頁應用程式」。
4. 設定：
    - **執行身分**：我 (Me)
    - **誰可以存取**：任何人 (Anyone)
5. 複製取得的 **Web App URL**。

### 2. 前端設定
1. 開啟 `js/main.js`。
2. 將 `const API_URL` 的值替換為步驟 1 取得的 Web App URL。

### 3. 前端部署 (GitHub Pages)
1. 將專案推送到 GitHub Repository (`master` 分支)。
2. 本專案已設定 GitHub Actions (`.github/workflows/deploy.yml`)，推送後會自動部署至 GitHub Pages。
3. 前往 GitHub Settings -> Pages 查看您的網站網址。

## 📝 使用說明

- **預設管理員帳號**：
    - 帳號：`admin`
    - 密碼：`admin123`
    - 權限：`RW` (讀寫)
- **測試建議**：建議首次登入後立即建立新的管理員帳號，並修改預設密碼。
