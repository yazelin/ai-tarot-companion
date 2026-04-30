# AI 塔羅心靈陪伴站

> 用科技與溫暖對話，陪伴社區長者

🌐 **Live**：<https://yazelin.github.io/ai-tarot-companion/>
💡 **靈感原案**：[信義公益實踐家 2026 — AI 塔羅心靈陪伴站](https://www.sinyicharity.org.tw/gather-ideas/vote/2026/13834)

一套專為社區據點設計的 AI 互動網站。長者透過大字體、語音優先的介面，與 AI 陪伴員「**亞澤**」進行塔羅抽牌、情緒對話、每日小任務、心願祝福牆四個模組。前端 GitHub Pages、後端 Cloudflare Workers、儲存 D1、語音用 Groq Whisper，全部都是免費 tier 可以用一輩子。

---

## 功能模組

| 模組 | 說明 |
|------|------|
| 🔮 **AI 塔羅互動** | 22 張大阿爾克那，每張都附「溫暖牌義」+「轉成今天的小任務」 |
| 💬 **情緒關懷對話** | 8 個情緒按鈕 + 語音/文字輸入，AI 用台灣阿姨的口氣回應 |
| ✅ **每日幸福任務** | 把抽到的牌轉成具體小任務（散步 10 分鐘、打電話給朋友） |
| 💝 **心願祝福牆** | 全社區共享，寫下心願 → 別的長者也看得到 |

## 設計原則（給長者用的差別）

- **大字體**：預設 22px，可一鍵切換到「大」「特大」
- **語音優先**：所有 AI 回應自動朗讀；麥克風一鍵錄音→送 Whisper 辨識
- **觸控目標 ≥ 44px**：連手指不靈光的長者都點得到
- **離線可用**：純前端 + Service Worker 快取 + localStorage，斷網仍可看祝福、抽牌、做任務
- **無需登入**：直接打開就用

## 系統架構

```
                 ┌─────────────────────────┐
                 │  GitHub Pages (前端)    │
                 │  index.html / app.js    │
                 │  Service Worker         │
                 └────────────┬────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│ /chat (LLM)  │      │ /transcribe  │     │  /wishes     │
│              │      │ (Whisper)    │     │              │
└──────┬───────┘      └──────┬───────┘     └──────┬───────┘
       │                     │                    │
       ▼                     ▼                    ▼
   Cloudflare Worker (tarot-companion.yazelinj303.workers.dev)
       │                     │                    │
       ▼                     ▼                    ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│ Groq Llama   │      │ Groq Whisper │     │ Cloudflare   │
│ 3.3 70B      │      │ large-v3     │     │ D1 SQLite    │
│ → OpenRouter │      │ turbo        │     │              │
│   Qwen 72B   │      │              │     │              │
│ → Gemini 2.5 │      │              │     │              │
│   Flash      │      │              │     │              │
└──────────────┘      └──────────────┘     └──────────────┘
   Fallback chain         單一 provider       共享心願
```

### 三家 LLM Fallback Chain

對話走 **Groq → OpenRouter → Gemini**，前一家失敗自動切下一家：

| 順位 | 服務 | 模型 | 免費額度 |
|------|------|------|---------|
| 1 | Groq | `llama-3.3-70b-versatile` | 14,400/天 + 500K tokens |
| 2 | OpenRouter | `qwen/qwen-2.5-72b-instruct:free` | 50/天/模型 |
| 3 | Google | `gemini-2.5-flash` | 1,500/天 |

### 中文簡轉繁

LLM 偶爾會吐簡體（特別是 Llama）、Whisper 也常輸出簡體中文。Worker 用 [opencc-js](https://github.com/nk2028/opencc-js) 的 `s2twp` 模式統一過濾，輸出都是台灣慣用詞繁中。

### 心願牆儲存

用 Cloudflare D1（SQLite-on-the-edge）共享。社區據點 A 寫的祝福，據點 B 也看得到。免費額度 5 GB / 5M reads / 100K writes，社區用一輩子用不完。Schema 在 `worker/migrations/0001_init_wishes.sql`。

### Service Worker 快取策略

`sw.js` 採 network-first。每次都試圖拿最新檔，失敗才退回快取。**不需要任何 `?v=` 手動 cache-bust**，每次 push GitHub Pages 部署完，使用者下次刷新就拿最新版。

## 語音 / TTS 現況

**STT（語音輸入）**：
- 預設用瀏覽器內建 `webkitSpeechRecognition`（免費、零後端）
- 高階：Worker `/transcribe` → Groq Whisper `large-v3-turbo`，對台腔國語、長者慢速說話特別寬容

**TTS（朗讀）**：
- 用瀏覽器內建 `speechSynthesis`，依瀏覽器/系統提供中文語音
- 偏好順序：**雲哲** → 曉雨 → 曉臻 → 任何 zh-TW
- Edge 瀏覽器使用者會自動拿到雲哲（微軟神經語音）
- 之後若要全平台統一雲哲，可改 Azure Speech Services（免費 50 萬字/月）

## 部署

### 前端

GitHub Pages 經 `.github/workflows/pages.yml` 自動部署，push 到 main 即上線。

### 後端 Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put GROQ_API_KEY        # 申請：console.groq.com/keys
npx wrangler secret put OPENROUTER_API_KEY  # 申請：openrouter.ai/settings/keys
npx wrangler secret put GEMINI_API_KEY      # 申請：aistudio.google.com/apikey
npx wrangler d1 execute tarot-wishes --remote --file=migrations/0001_init_wishes.sql
npx wrangler deploy
```

部署後把 Worker URL 寫進 `scripts/config.js` 的 `TAROT_API`。

## 技術棧

- **前端**：Vanilla JS（無 build step）、CSS Grid、Service Worker
- **後端**：Cloudflare Workers + D1（無伺服器）
- **語音**：Web Speech API（內建）+ Groq Whisper（後端）
- **LLM**：Groq Llama 3.3 70B + OpenRouter Qwen 2.5 72B + Gemini 2.5 Flash
- **後處理**：opencc-js（簡轉繁台灣詞）
- **CI/CD**：GitHub Actions

## 路線圖

- [x] 22 張大阿爾克那 + 4 個模組基本可用
- [x] 真 LLM 對話（Groq Llama 3.3 70B）
- [x] AI 連線狀態小燈
- [x] 手機 RWD
- [x] 心願牆改 D1 共享
- [x] OpenCC 簡轉繁
- [x] Service Worker 自動更新
- [ ] Azure Speech 接雲哲 TTS（讓 iPad/Android 也聽得到雲哲）
- [ ] 家屬端：阿嬤抽到負面牌時通知
- [ ] 跨世代陪伴模式：青年志工協助操作
- [ ] LINE 通知整合

## 授權

MIT。歡迎社區據點直接 fork 拿去用。
