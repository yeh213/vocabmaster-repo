# CLAUDE.md

This file is the working specification for AI agents editing VocabMaster Cloud.
For roadmap and phase status, see `PLAN.md` (keep its checkboxes in sync when finishing a feature).

## Project

VocabMaster Cloud is a single-user English vocabulary app hosted on Cloudflare.

| Part | Path | Stack | Deployed at |
|---|---|---|---|
| Frontend | `frontend/` | Vue 3 + Vite, Element Plus, Pinia, Vue Router | `https://vocabmaster-13l.pages.dev` (Cloudflare Pages) |
| API | `worker/` | Cloudflare Worker + Hono | `https://vocabmaster-worker.hiyeh.workers.dev` |
| Database | `worker/migrations/` | Cloudflare D1 (SQLite), binding `DB`, database `vocabmaster` | — |

- Single user only. No multi-account, no social features.
- Vocabulary only. The quizzes and notes modules were removed on 2026-11-10 (frontend pages/stores and Worker routes/handlers). Their D1 tables still exist but are unused; do not re-add these modules unless the user asks.
- No R2: the Readings/PDF module is skipped (R2 needs a credit card).
- The old pure-frontend version (root `index.html` / `app.js` / `style.css` / `vocab-data.json`) was deleted on 2026-11-10. Do not recreate it.

## Layout

```
worker/
  wrangler.toml            D1 binding
  migrations/              0001_init.sql (words/quizzes/notes), 0002_decks.sql (decks + words.deck_id)
  src/index.js             Hono routes; all /api/* go through CORS + auth
  src/auth.js              Bearer token check against secret API_TOKEN
  src/db.js                groupIdFromWord, newId, today
  src/handlers/            words.js (incl. SM-2), decks.js
frontend/
  .env                     VITE_API_BASE (production Worker URL)
  vite.config.js           dev proxy /api -> http://localhost:8787
  public/vocab-data.json   original 1500 words (camelCase, schema v2); no longer loaded by code
  src/api.js               fetch wrapper, adds Authorization: Bearer <token>
  src/router.js            /login, /vocab (unknown paths redirect to /vocab)
  src/stores/              auth, words, decks, aiSettings
  src/views/               LoginView, VocabView
  src/components/          NavSidebar, ReviewDialog (typing practice), ImportDialog (file import), AISettingsDialog
  src/utils/importParser.js  CSV/JSON parsing for file import
```

## Auth

- Worker compares `Authorization: Bearer <token>` with the Worker secret `API_TOKEN` (set via `wrangler secret put API_TOKEN`).
- Frontend stores the token in `localStorage` key `api_token`; `LoginView` is the input screen.
- Never hard-code the token in source.

## Data Model (D1)

API responses and request bodies use the D1 column names (snake_case): `part_of_speech`, `group_id`, `deck_id`, `due_date`, `ease_factor`, etc.
`POST /api/words/import` additionally accepts camelCase fields (`partOfSpeech`, `dueDate`, `easeFactor`, ...) from the old JSON format.

### words

| Column | Notes |
|---|---|
| `id` | UUID (`crypto.randomUUID()`) |
| `word` | English word |
| `definition` | joined readable summary of Chinese meanings, e.g. `商業的;商業廣告` |
| `part_of_speech` | joined summary, e.g. `adj.;n.` |
| `example` | first/best example, for list display |
| `senses` | JSON string; source of truth for meanings / POS / examples (see below) |
| `group_id` | `letter-a` … `letter-z` or `NULL`, always derived from `word` |
| `deck_id` | FK to `decks.id`, or `NULL` = 未分類 |
| `created_at` | `YYYY-MM-DD` |
| SM-2 fields | `repetitions`, `ease_factor` (2.5), `interval` (1), `due_date`, `last_reviewed`, `total_reviews`, `correct_count` |

`senses` structure — keep meanings and examples tied to their sense; never store parallel arrays that lose the relationship:

```json
[
  {
    "partOfSpeech": "adj.",
    "definitions": ["商業的"],
    "examples": [{ "en": "The commercial district is busy.", "zh": "商業區很繁忙。" }]
  },
  {
    "partOfSpeech": "n.",
    "definitions": ["商業廣告"],
    "examples": [{ "en": "I saw a commercial on TV.", "zh": "我在電視上看到一則廣告。" }]
  }
]
```

When writing a word, keep the flat fields (`definition`, `part_of_speech`, `example`) consistent with `senses`.

### decks

`id`, `name`, `created_at`. `GET /api/decks` also returns `word_count`.
Deleting a deck sets its words' `deck_id` to `NULL` (words are not deleted).
The original 1500 words are in the deck「成大」(id `deck-ncku` according to `PLAN.md`; not re-verified against D1).

### quizzes / notes (unused)

Created by `0001_init.sql`, no longer used by any code. Do not DROP them without asking the user (they may contain data).

Schema changes go in a new numbered migration file (`worker/migrations/0003_*.sql`); never edit applied migrations.

## Rules

### Letter groups (A–Z)

- `group_id` is always computed from the first letter of `word` by `groupIdFromWord` in `worker/src/db.js` (`apple` → `letter-a`, non A–Z → `NULL`).
- The Worker recalculates it on create, update and import. Never let the user pick it and never trust a client-sent `group_id`.
- Letter groups are fixed. Use decks for custom collections, not new groups.

### SM-2

- Implemented server-side in `worker/src/handlers/words.js` (`calcSM2`); call `POST /api/words/:id/review` with `quality` 0–5.
- `quality >= 3` counts as correct. Typing practice sends 5 for correct, 1 for wrong/skip.
- Practice mode (「顯示答案」) must not call the review API.

### Adding vocabulary from images

Default image source folder: `C:\Users\AAFCT\Desktop\新增\圖片` (OCR intermediates live in `_converted`, `_ocr`, `_ocr_json`, `_review`).

1. Read/OCR the image.
2. Extract each word with all visible information: English word, Chinese meanings, part(s) of speech, English example(s), Chinese translation(s) of examples.
3. If any of these is unclear, flag it explicitly. Do not guess unclear text into the vocabulary bank.
4. Show the extracted list to the user first, and ask which deck the words should go into.
5. Wait for confirmation or corrections.
6. Only after confirmation, write the words through `POST /api/words/import` with `{ words, deck_id }`.
7. Check for duplicates of existing words before writing (the import endpoint also skips them).

### File import (in-app)

`components/ImportDialog.vue` + `utils/importParser.js`, opened by「📥 匯入檔案」in `VocabView`.

- Formats: CSV and JSON only (no .xlsx, to avoid a large parser dependency).
- CSV columns: `word, part_of_speech, definition, example, example_zh`; only `word` and `definition` are required. Chinese header aliases (單字/詞性/中文/例句/例句翻譯) are accepted.
  - Several rows with the same word (case-insensitive) merge into one word; each row becomes one sense.
  - Multiple meanings within a sense are separated by `;` or `；`.
  - Encoding: UTF-8 (with or without BOM); falls back to Big5 for Excel's legacy CSV.
- JSON: `{ "words": [...] }` (vocab-data.json format) or a bare array; SM-2 fields are kept.
- Flow: pick file → preview (new / already exists / error per row) → choose deck (or create one) → import.
- Duplicates are always skipped, never overwritten. `POST /api/words/import` enforces this server-side (`WHERE NOT EXISTS` on same id or same word `COLLATE NOCASE`) and returns `{ inserted, skipped }`.
- The body-level `deck_id` applies to all words in the request; per-word `deck_id` is ignored.

Never write recognized image content without first showing the extracted list.

### Gemini (planned, not implemented)

- AI settings UI exists: `stores/aiSettings.js` saves `{ apiKey, model }` to `localStorage` key `vocabmaster_ai`; default model `gemini-3.7-flash`.
- No Gemini calls exist yet. Planned features: 造句批改, AI 出題, 情境對話 (see `PLAN.md` §14).
- Where the key lives (browser vs. Worker secret `GEMINI_API_KEY`) is not decided yet — ask the user before implementing the first AI call.

## Known Issues

- The edit form in `VocabView.vue` only edits the flat fields and does not send `senses`; `updateWord` keeps the stored `senses` when the body omits it. After an edit, the flat fields and `senses` can therefore diverge. There is no sense editor yet, and no UI displays `senses`.
- `frontend/src/components/HelloWorld.vue` and `src/assets/hero.png` are unused Vite template leftovers.
## Sorting

- Word lists are sorted A→Z case-insensitively: Worker uses `ORDER BY word COLLATE NOCASE`, and `stores/words.js` re-sorts with `byWord` after fetch/add/edit. Keep both in sync.

## Commands

```powershell
# Local dev (two terminals)
cd worker;   npx wrangler dev        # http://localhost:8787, local D1
cd frontend; npm run dev             # Vite, proxies /api to 8787

# Apply migrations
# Unverified: whether 0001/0002 were applied via `migrations apply` (tracked in d1_migrations)
# or via `d1 execute --file`. If the latter, `migrations apply` will re-run 0002 and its
# ALTER TABLE will fail. Check first:
#   npx wrangler d1 execute vocabmaster --remote --command "SELECT * FROM d1_migrations"
cd worker; npx wrangler d1 migrations apply vocabmaster --local
cd worker; npx wrangler d1 migrations apply vocabmaster --remote   # production — confirm with user first

# Deploy — confirm with user first
cd worker;   npx wrangler deploy
cd frontend; npm run build; npx wrangler pages deploy dist --project-name vocabmaster
```

## Verification

After code edits:

- Frontend: `cd frontend; npm run build` must succeed.
- Worker: `node --check` each changed file under `worker/src/`, or `npx wrangler deploy --dry-run`.
- After schema changes: apply the migration with `--local` and exercise the affected endpoints via `wrangler dev`.
- Update `PLAN.md` checkboxes when a feature is completed.
