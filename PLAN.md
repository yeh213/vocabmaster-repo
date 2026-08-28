# 英文學習 App 雲端化計畫書

**專案代號**:VocabMaster Cloud
**建立日期**:2026-08-08
**最後更新**:2026-08-19（晚）
**狀態**:開發中，Deck 功能完成
**專案目錄**:`c:\Users\AAFCT\Desktop\新增\`

---

## 1. 專案概述

把現有純前端 VocabMaster（localStorage 版本）升級為 Cloudflare 雲端英文學習 app，支援手機/桌機同步，並擴充為 4 個學習模組。

### 動機
- 目前資料只在桌機 localStorage，手機無法存取
- 想利用手機零碎時間背英文／讀英文／練題目
- 為未來 Gemini API 整合（AI 例句、文法解析）預留 backend
- 免費、不需要信用卡

### 使用者
單一使用者（專案作者）。**不做多帳號、社群功能。**

---

## 2. 目標與範圍

### 做什麼（In Scope）
- 4 個固定學習模組
  - **單字**：SM-2 間隔重複、A-Z 字首分類
  - **考題**：選項/答案/解釋，標籤 TOEIC/GEPT/TOEFL
  - **筆記**：Markdown 編輯與渲染，支援匯入 `.md`
  - **閱讀**：PDF 上傳與線上檢視
- Bearer token 保護（單人用，輸入一次存入 localStorage）
- 手機、桌機開一個 URL 即可使用
- 從舊 vocab-data.json 首次匯入 1500 字

### 不做什麼（Out of Scope）
- 多使用者、社群、留言、分享
- 多科目（日文、其他學科）
- 自訂模組類型
- 離線模式 / PWA
- Google 登入（單人 app 不需要）

---

## 3. 技術棧

| 層 | 選擇 | 備註 |
|---|---|---|
| 前端框架 | **Vue 3** + Vite | 從純 JS 轉換成本最低 |
| UI 元件庫 | **Element Plus** | 繁中文件完整，元件豐富 |
| 狀態管理 | **Pinia** | Vue 3 官方推薦 |
| 路由 | **Vue Router** | 官方 |
| PDF 顯示 | `vue-pdf-embed`（基於 PDF.js） | |
| Markdown | `markdown-it` + `highlight.js` | |
| 前端託管 | **Cloudflare Pages** | 免費，無限請求 |
| 後端 API | **Cloudflare Workers**（Hono） | 免費 10 萬次/天 |
| 資料庫 | **Cloudflare D1**（SQLite） | 免費 500MB，500 萬讀/10 萬寫/天 |
| 檔案儲存 | **Cloudflare R2** | 免費 10GB |
| 認證 | Bearer token（存 Worker secret） | 輸入一次，localStorage 保存 |
| CLI | `wrangler` | Cloudflare 官方 CLI |

---

## 4. 系統架構

```
        ┌────────────────────────┐
        │  瀏覽器（桌機 / 手機）     │
        │  Vue 3 SPA             │
        │  Cloudflare Pages      │
        └─────────┬──────────────┘
                  │ HTTPS /api/* + Authorization: Bearer <token>
                  │
        ┌─────────▼──────────────┐
        │  Cloudflare Worker     │
        │  （Hono 路由框架）       │
        │  1. 驗 Bearer token    │
        │  2. 路由到 handler     │
        │  3. 讀寫 D1 / R2       │
        └────┬──────────────┬────┘
             │              │
      ┌──────▼──┐    ┌───────▼──────┐
      │ D1 (SQL)│    │ R2（PDF 檔）  │
      └─────────┘    └──────────────┘
```

---

## 5. D1 Schema（SQLite）

### words
```sql
CREATE TABLE words (
  id          TEXT PRIMARY KEY,
  word        TEXT NOT NULL,
  definition  TEXT,
  part_of_speech TEXT,
  example     TEXT,
  senses      TEXT,           -- JSON 字串
  group_id    TEXT,           -- "letter-a" ~ "letter-z" 或 NULL
  created_at  TEXT,

  -- SM-2
  repetitions   INTEGER DEFAULT 0,
  ease_factor   REAL    DEFAULT 2.5,
  interval      INTEGER DEFAULT 1,
  due_date      TEXT,
  last_reviewed TEXT,
  total_reviews INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0
);

CREATE INDEX idx_words_group_id ON words(group_id);
CREATE INDEX idx_words_due_date ON words(due_date);
```

### quizzes
```sql
CREATE TABLE quizzes (
  id          TEXT PRIMARY KEY,
  question    TEXT NOT NULL,
  options     TEXT,           -- JSON 陣列
  answer      TEXT,
  explanation TEXT,
  category    TEXT,           -- "TOEIC" | "GEPT" | "TOEFL" | NULL
  created_at  TEXT
);

CREATE INDEX idx_quizzes_category ON quizzes(category);
```

### notes
```sql
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  content    TEXT,            -- markdown 原文
  created_at TEXT,
  updated_at TEXT
);
```

### readings
```sql
CREATE TABLE readings (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  storage_key TEXT,           -- R2 key，例 "readings/abc123.pdf"
  size        INTEGER,
  mime        TEXT,
  uploaded_at TEXT
);
```

---

## 6. R2 儲存結構

```
vocabmaster-readings/
└─ readings/
    └─ {uuid}.pdf
```

---

## 7. 認證機制

Worker 讀取環境變數 `API_TOKEN`（透過 `wrangler secret put API_TOKEN` 設定，不寫死在程式碼裡）。

```js
// auth.js (Worker middleware)
export function authMiddleware(c, next) {
  const header = c.req.header('Authorization') ?? '';
  const token = header.replace('Bearer ', '');
  if (token !== c.env.API_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
}
```

前端（`api.js`）：
```js
const TOKEN = localStorage.getItem('api_token');
fetch('/api/words', { headers: { Authorization: `Bearer ${TOKEN}` } });
```

`LoginView.vue` 只是一個輸入框，輸入 token 後存入 localStorage。

---

## 8. Workers API 規格

所有 endpoint 都要求 `Authorization: Bearer <token>` header。回應 JSON。

### Words API
| Method | Path | 用途 |
|---|---|---|
| GET | `/api/words` | 列全部，支援 `?group_id=letter-a&due_before=2026-08-10` |
| GET | `/api/words/:id` | 單筆 |
| POST | `/api/words` | 新增（自動算 group_id） |
| PUT | `/api/words/:id` | 更新 |
| DELETE | `/api/words/:id` | 刪除 |
| POST | `/api/words/import` | 批次匯入（body: `words: [...]`） |
| POST | `/api/words/:id/review` | SM-2 記錄複習（body: `quality: 0-5`） |

### Quizzes API
| Method | Path | 用途 |
|---|---|---|
| GET | `/api/quizzes` | 列全部，支援 `?category=TOEIC` |
| POST | `/api/quizzes` | 新增 |
| PUT | `/api/quizzes/:id` | 更新 |
| DELETE | `/api/quizzes/:id` | 刪除 |

### Notes API
| Method | Path | 用途 |
|---|---|---|
| GET | `/api/notes` | 列全部 |
| GET | `/api/notes/:id` | 單筆 |
| POST | `/api/notes` | 新增 |
| PUT | `/api/notes/:id` | 更新 |
| DELETE | `/api/notes/:id` | 刪除 |
| POST | `/api/notes/import` | 匯入 `.md`（body: `title, content`） |

### Readings API
| Method | Path | 用途 |
|---|---|---|
| GET | `/api/readings` | 列全部 metadata |
| POST | `/api/readings` | 上傳 PDF（multipart，寫入 R2 + 建 D1 row） |
| GET | `/api/readings/:id/url` | 取得 R2 presigned URL 供 vue-pdf-embed 載入 |
| DELETE | `/api/readings/:id` | 刪 D1 row + R2 物件 |

---

## 9. 前端頁面結構

### 路由
| Path | View | 說明 |
|---|---|---|
| `/login` | `LoginView.vue` | 輸入 API token |
| `/` | 重導向到 `/vocab` | |
| `/vocab` | `VocabView.vue` | 單字模組 |
| `/quiz` | `QuizView.vue` | 考題 |
| `/notes` | `NotesView.vue` | 筆記（含 `.md` 匯入） |
| `/readings` | `ReadingsView.vue` | PDF 閱讀 |

### 主要 Component
- `NavSidebar.vue`：左側 4 個模組 tab
- `AuthGate.vue`：未輸入 token 時擋在最外層
- `VocabList.vue` / `VocabAdd.vue` / `VocabQuiz.vue`
- `QuizPlayer.vue`
- `MdEditor.vue`
- `PdfViewer.vue`
- `ImportMdDialog.vue`

### Pinia stores
- `auth`：token、isLoggedIn
- `words`：1500 字快取、SM-2 due 清單
- `quizzes` / `notes` / `readings`

---

## 10. 目錄結構

```
c:\Users\AAFCT\Desktop\新增\
├─ PLAN.md
├─ CLAUDE.md
│
├─ frontend/                      Vue 3 SPA → Cloudflare Pages
│   ├─ index.html
│   ├─ vite.config.js
│   ├─ package.json
│   └─ src/
│       ├─ main.js
│       ├─ App.vue
│       ├─ router.js
│       ├─ api.js                 fetch wrapper（帶 Bearer token）
│       ├─ stores/
│       │   ├─ auth.js
│       │   ├─ words.js
│       │   ├─ quizzes.js
│       │   ├─ notes.js
│       │   └─ readings.js
│       ├─ views/
│       │   ├─ LoginView.vue
│       │   ├─ VocabView.vue
│       │   ├─ QuizView.vue
│       │   ├─ NotesView.vue
│       │   └─ ReadingsView.vue
│       ├─ components/
│       │   ├─ NavSidebar.vue
│       │   ├─ AuthGate.vue
│       │   ├─ VocabList.vue
│       │   ├─ VocabAdd.vue
│       │   ├─ VocabQuiz.vue
│       │   ├─ QuizPlayer.vue
│       │   ├─ MdEditor.vue
│       │   ├─ PdfViewer.vue
│       │   └─ ImportMdDialog.vue
│       └─ utils/
│           ├─ sm2.js
│           └─ groupId.js
│
├─ worker/                        Cloudflare Worker（Hono）
│   ├─ package.json
│   ├─ wrangler.toml
│   └─ src/
│       ├─ index.js               Hono app entry
│       ├─ auth.js                Bearer token middleware
│       ├─ db.js                  D1 helpers
│       └─ handlers/
│           ├─ words.js
│           ├─ quizzes.js
│           ├─ notes.js
│           └─ readings.js
│
└─ [legacy/]                      舊檔暫留，匯入完成後刪
    ├─ index.html
    ├─ app.js
    ├─ style.css
    └─ vocab-data.json
```

---

## 11. 開發階段

### Phase 0：環境準備 ✅
- [x] 安裝 Node.js 24 LTS
- [x] 建立 Cloudflare 帳號
- [x] `npm install -g wrangler`
- [x] `wrangler login`

### Phase 1：Worker 骨架 + D1 ✅
- [x] `worker/` 目錄，Hono 框架
- [x] `wrangler d1 create vocabmaster`（database_id: 6c259714-8d5c-493a-a487-cc7bf49c7266）
- [x] 設定 `wrangler.toml`
- [x] SQL migration：words / quizzes / notes 三張表
- [x] auth middleware（Bearer token）
- [x] `wrangler secret put API_TOKEN`
- [x] Worker 部署：`https://vocabmaster-worker.hiyeh.workers.dev`
- [x] **驗收**：`/api/ping` 回 200 ✅
- 備註：R2 需信用卡，跳過 Readings 模組

### Phase 2：Words 模組（部分完成）
- [x] handlers/words.js（CRUD + 批次 import + SM-2 review API）
- [x] Vue：LoginView、VocabView（列表、新增、編輯、刪除、字首篩選）
- [x] 「☁️ 首次匯入」：分批 200 筆，1500 字全部上雲 ✅
- [x] 前端部署：`https://vocabmaster-13l.pages.dev` ✅
- [x] Deck（單字集）功能：D1 新增 decks 表、CRUD API、前端管理介面
- [x] 成大 1500 字已全部指定到「成大」Deck（deck-ncku）
- [x] 首頁改為 Deck 卡片列表，點入才顯示單字
- [ ] 單字卡翻牌模式
- [ ] 打字練習模式
- [ ] SM-2 今日到期複習列表

### Phase 3：Quizzes 模組（部分完成）
- [x] handlers/quizzes.js（CRUD）
- [x] QuizView（管理介面：新增/編輯/刪除）
- [ ] 作答模式（QuizPlayer）

### Phase 4：Notes 模組（部分完成）
- [x] handlers/notes.js（CRUD + import）
- [x] NotesView（編輯、Markdown 預覽、匯入 .md）
- [ ] **驗收**：實際測試寫筆記與匯入

### Phase 5：Readings 模組 — 跳過
- R2 需信用卡，暫不實作

### Phase 6：收尾
- [ ] 單字卡複習功能完成
- [ ] 考題作答模式
- [ ] 手機版 UI 優化
- [ ] 刪除 legacy 舊檔

### Phase 6：收尾（0.5 天）
- [ ] 刪 `legacy/` 舊檔
- [ ] 更新 CLAUDE.md（反映新架構）
- [ ] 設定自訂網域（選填，Cloudflare Pages 本身就給 `.pages.dev` 網址）

**總估**：約 7 個工作日。

---

## 12. 部署流程

### Worker 部署
```powershell
cd worker
wrangler deploy
```

### 前端部署
```powershell
cd frontend
npm run build
wrangler pages deploy dist --project-name vocabmaster
```

### 本地開發
```powershell
# Worker（帶 D1/R2 本地模擬）
cd worker
wrangler dev

# 前端（另開終端機）
cd frontend
npm run dev
```

---

## 13. 成本估算

以個人單一使用者、每日 100 次 API 呼叫估算：

| 項目 | 免費額度 | 實際用量 | 是否超額 |
|---|---|---|---|
| Workers 請求 | 10 萬/天 | ~100/天 | 否 |
| Workers CPU 時間 | 10ms/請求 | 遠低於限制 | 否 |
| D1 讀取 | 500 萬/天 | ~1000/天 | 否 |
| D1 寫入 | 10 萬/天 | ~200/天 | 否 |
| D1 儲存 | 500 MB | ~50 MB | 否 |
| R2 儲存 | 10 GB | ~2 GB | 否 |
| R2 操作 | 100 萬 Class A/月 | ~300/月 | 否 |
| Pages 部署 | 500 次/月 | 個位數/月 | 否 |

**預期月費**：$0，不需信用卡

---

## 14. 未來擴充（不在本次範圍）

### Gemini 整合
- 在 `worker/src/handlers/` 加 `ai.js`
- Endpoints：
  - `POST /api/ai/gen-example`：給單字產生新例句
  - `POST /api/ai/grammar-check`：批改英文句子
  - `POST /api/ai/reading-summary`：PDF 內容摘要
- API key 存 Worker secret：`wrangler secret put GEMINI_API_KEY`
- 前端只呼叫 `/api/ai/*`，永遠看不到 key

---

## 15. 風險與注意事項

| 風險 | 說明 | 因應 |
|---|---|---|
| D1 是 SQLite | 不能 JOIN 太複雜，但這個 app 不需要 | 各表獨立查詢即可 |
| Workers 有 CPU 時間限制 | 每請求 10ms（免費）/ 30ms（付費） | PDF 上傳直接傳 R2，不過 Worker 處理 |
| Token 外洩 | Bearer token 放 localStorage 有 XSS 風險 | 個人 app 可接受；未來可改 httpOnly cookie |
| PDF 大檔 | Workers 請求 body 上限 100MB | 分段上傳或前端直傳 R2 presigned URL |
| 舊 SM-2 邏輯 | 需從 app.js 正確搬到 worker | 先搬 utils/sm2.js，匯入後抽樣驗算 |

---

## 附錄：動工前需要準備的東西
- [x] Node.js 24 LTS 已安裝
- [ ] Cloudflare 帳號（cloudflare.com 免費註冊）
- [ ] `npm install -g wrangler`
- [ ] `wrangler login`
- [ ] 舊資料備份（vocab-data.json 已在專案目錄，保留即可）
