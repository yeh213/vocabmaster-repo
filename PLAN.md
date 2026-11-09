# VocabMaster Cloud 計畫書

**建立日期**：2026-08-08
**最後更新**：2026-11-10
**狀態**：上線使用中（單字模組）；下一步為複習功能與 Gemini AI 功能
**專案目錄**：`c:\Users\AAFCT\Desktop\新增\`

> 技術細節（資料表、API、目錄結構、開發規則）以 [CLAUDE.md](CLAUDE.md) 為準，本文件只記錄目標、進度與規劃。

---

## 1. 專案概述

把原本只存在桌機瀏覽器的 VocabMaster 改成 Cloudflare 上的雲端單字 app，手機和電腦開同一個網址、資料同步。

### 動機
- 原本資料只在桌機 localStorage，手機無法使用
- 想利用手機零碎時間背單字
- 為 Gemini API 整合（AI 造句批改、出題等）預留 backend
- 免費、不需要信用卡

### 使用者
單一使用者（專案作者）。不做多帳號、社群功能。

### 網址
| 用途 | 網址 |
|---|---|
| App（前端） | https://vocabmaster-13l.pages.dev |
| API（Worker） | https://vocabmaster-worker.hiyeh.workers.dev |
| 原始碼 | https://github.com/yeh213/vocabmaster-repo |

網址決定維持 `vocabmaster-13l.pages.dev`，不換名稱、不買網域（2026-11-10）。

---

## 2. 範圍

### 做什麼
- **單字**：A–Z 字首分類、單字集（Deck）、SM-2 間隔重複、打字練習、檔案匯入
- 手機與桌機都能順暢使用
- Bearer token 保護（單人用）

### 不做什麼
- 考題、筆記模組（2026-11-10 移除）
- PDF 閱讀模組（R2 需信用卡）
- 多使用者、社群、分享
- 多科目、自訂模組類型
- 離線模式 / PWA
- Google 登入

---

## 3. 技術棧

| 層 | 選擇 | 備註 |
|---|---|---|
| 前端 | Vue 3 + Vite | |
| UI 元件庫 | Element Plus（按需載入） | 繁中文件完整 |
| 狀態管理 / 路由 | Pinia / Vue Router | |
| 前端託管 | Cloudflare Pages | 免費 |
| 後端 API | Cloudflare Workers + Hono | 免費 10 萬次/天 |
| 資料庫 | Cloudflare D1（SQLite） | 免費 500MB |
| 認證 | Bearer token（Worker secret） | 前端存 localStorage |
| CLI | wrangler | |

```
 瀏覽器（手機 / 桌機）── Vue 3 SPA（Cloudflare Pages）
          │  HTTPS /api/*  +  Authorization: Bearer <token>
          ▼
 Cloudflare Worker（Hono）── 驗 token → 讀寫 D1
          ▼
 D1：words、decks（quizzes、notes 表保留但未使用）
```

---

## 4. 開發進度

### ✅ 已完成
- **基礎建設**：Node.js、Cloudflare 帳號、wrangler、D1（`vocabmaster`）、Worker 與 Pages 部署
- **單字 CRUD**、A–Z 字首篩選、搜尋
- **單字集（Deck）**：建立、改名、刪除、批次移動；成大 1500 字在「成大」單字集
- **打字練習**：看中文打英文 / 看英文打中文、練習模式（不計 SM-2）/ 測驗模式（寫回 SM-2）
- **檔案匯入**（2026-11-10）：CSV / JSON、預覽、已存在自動略過、選擇或新建單字集
- **排序**：A→Z 不分大小寫（2026-11-10）
- **手機版**（2026-11-10）：頂部選單、單字卡片、對話框配合螢幕、iOS 不會自動放大
- **效能**（2026-11-10）：Element Plus 按需載入（JS 1153→約 490 KB）、單字列表分頁（每頁 50）
- **AI 設定入口**：側欄輸入 Gemini API Key、選模型（清單 2026-11-10 更新）
- **整理**：刪除舊版純前端檔案、考題與筆記模組；CLAUDE.md 改寫為雲端版規格

### ⬜ 待做（建議順序）
1. **SM-2 今日到期複習**：列出今天該複習的字，直接進入練習
2. **單字卡翻牌模式**：看正面想答案、翻面自評（對應 SM-2 品質分數）
3. **義項（senses）顯示與編輯**：目前只顯示摘要欄位；多詞性、例句與翻譯尚未在畫面呈現，編輯表單也改不到 senses
4. **Gemini AI 功能**（見第 6 節）

---

## 5. 部署與開發

```powershell
# 部署 Worker
cd worker
npx wrangler deploy

# 部署前端（另開終端機，或先 cd 回專案根目錄）
cd frontend
npm run build
npx wrangler pages deploy dist --project-name vocabmaster

# 本機開發（兩個終端機）
cd worker;   npx wrangler dev     # http://localhost:8787
cd frontend; npm run dev          # 自動把 /api 轉到 8787
```

---

## 6. 未來規劃：Gemini 整合

| 功能 | 說明 |
|---|---|
| AI 造句批改 | 看到單字後自己造句，AI 判斷用法是否正確、自然並給建議 |
| AI 出題 | 即時產生干擾性更高的選項、填空題、中翻英題 |
| 情境對話 | AI 扮演對話角色，使用者用指定單字回應 |

**待決定**：API Key 放哪裡
- 放瀏覽器（目前的設定入口）：實作最簡單，但每台裝置都要各自輸入
- 放 Worker secret（`wrangler secret put GEMINI_API_KEY`）：只設定一次、前端看不到 key，Worker 需新增 `/api/ai/*` 路由

模型：預設 `gemini-3.8-flash`（免費方案可用）。

---

## 7. 成本

個人單一使用者，全部在免費額度內：

| 項目 | 免費額度 | 預估用量 |
|---|---|---|
| Workers 請求 | 10 萬/天 | ~100/天 |
| D1 讀取 / 寫入 | 500 萬 / 10 萬 每天 | ~1000 / ~200 每天 |
| D1 儲存 | 500 MB | < 50 MB |
| Pages 部署 | 500 次/月 | 個位數/月 |

**月費**：$0，不需信用卡。Gemini API 使用免費方案模型時同樣不收費。

---

## 8. 風險與注意事項

| 風險 | 因應 |
|---|---|
| Token 存在 localStorage，有 XSS 風險 | 個人 app 可接受 |
| 每次載入抓全部單字（約 1 MB） | 目前 1500 字可接受；字數大幅增加時改成分頁 API |
| GitHub repo 含 `圖片/` 照片（約 430 MB） | 不影響使用；之後可加入 `.gitignore` 只留本機 |
| D1 migration 是否由 wrangler 追蹤不確定 | 新增 migration 前先查 `d1_migrations` 表（見 CLAUDE.md） |

---

## 變更紀錄

| 日期 | 內容 |
|---|---|
| 2026-08-08 | 建立計畫（原為 Firebase / GCP 方向） |
| 2026-08-19 | 改為 Cloudflare；完成 Worker、D1、前端部署、1500 字上雲、Deck 功能 |
| 2026-08-29 | 側欄加入 AI 設定 |
| 2026-11-10 | 範圍縮小為只做單字；刪除舊版與考題/筆記；新增檔案匯入、手機版、效能優化；修正排序、匯入單字集、編輯清空義項等 bug；更新 Gemini 模型清單 |
