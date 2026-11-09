# VocabMaster 前端

Vue 3 + Vite + Element Plus 的單字練習 app，部署在 Cloudflare Pages：https://vocabmaster-13l.pages.dev

API 由 `../worker`（Cloudflare Worker）提供。專案規格與開發規則見 [../CLAUDE.md](../CLAUDE.md)，進度見 [../PLAN.md](../PLAN.md)。

## 指令

```powershell
npm install      # 第一次
npm run dev      # 本機開發，/api 會轉到 http://localhost:8787（先在 ../worker 跑 npx wrangler dev）
npm run build    # 打包到 dist/
npx wrangler pages deploy dist --project-name vocabmaster   # 部署
```

## 設定

- `.env.production` 的 `VITE_API_BASE`：正式版 API 網址（Worker），只有 `npm run build` 會用到。
- `npm run dev` 不讀這個檔，`/api` 走 Vite proxy 到本機 Worker，不會動到雲端資料。
