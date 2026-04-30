# Cloudflare Worker 後端

提供 `/chat`（LLM 對話，含 fallback 鏈）與 `/transcribe`（Groq Whisper 語音辨識）兩條 API。

## 申請免費 API Key

至少申請一家，**建議三家都拿**讓 fallback 完整：

| 服務 | 申請網址 | 拿什麼 | 免費額度 |
|------|---------|--------|---------|
| Groq | https://console.groq.com/keys | API Key（gsk_...） | 14,400 LLM/天 + 7,200 Whisper/天 |
| OpenRouter | https://openrouter.ai/settings/keys | API Key（sk-or-...） | 50/天/模型（中文最佳） |
| Google AI Studio | https://aistudio.google.com/apikey | API Key | 1,500/天（gemini-2.5-flash） |

## 部署

```bash
# 1) 第一次：登入 Cloudflare
npx wrangler login

# 2) 上傳金鑰（互動輸入，金鑰不會留在檔案）
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put OPENROUTER_API_KEY      # 選填
npx wrangler secret put GEMINI_API_KEY          # 選填

# 3) 部署
npx wrangler deploy
```

部署完成會給您一個網址，例如 `https://tarot-companion.<您的帳號>.workers.dev`。

## 確認運作

```bash
curl https://tarot-companion.<您>.workers.dev/health
# {"ok":true,"providers":{"groq":true,"openrouter":false,"gemini":false}}

curl -X POST https://tarot-companion.<您>.workers.dev/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"我今天有點想念以前的朋友"}'
# {"reply":"…","provider":"groq"}
```

## 接到前端

把 Worker 網址寫進 `scripts/config.js`：

```js
window.CHAT_API_URL = 'https://tarot-companion.<您>.workers.dev/chat';
window.GROQ_PROXY_URL = 'https://tarot-companion.<您>.workers.dev/transcribe';
```

`ai.js` 的 `askClaude()` 會自動走這條路；麥克風按鈕會自動切到 Groq Whisper 模式。

## 除錯

```bash
npx wrangler tail
```
