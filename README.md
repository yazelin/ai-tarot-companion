# AI 塔羅心靈陪伴站

> 用科技與溫暖對話，陪伴社區長者

一套專為社區長者設計的互動網站：大字體、語音優先、純前端、可部署到 GitHub Pages 零成本上線。透過抽塔羅牌、情緒對話、每日小任務、心願祝福牆等四個簡單模組，讓科技成為長者的貼心朋友。

## 功能模組

| 模組 | 入口 | 說明 |
|------|------|------|
| 🔮 AI 塔羅互動 | 抽一張牌 | 22 張大阿爾克那，溫暖口吻解讀 + 朗讀 |
| 💬 情緒關懷對話 | 聊聊天 | 8 個情緒按鈕 + 語音/文字輸入 |
| ✅ 每日幸福任務 | 今日任務 | 把牌義轉為小任務（散步、打電話給朋友等） |
| 💝 心願祝福牆 | 祝福牆 | 寫下心願 + 看到其他長者的祝福 |

## 設計原則

- **大字體** — 預設 22px，可一鍵切換到「大」「特大」
- **語音優先** — AI 回應會自動朗讀；輸入端支援語音辨識
- **離線可用** — 純前端 + `localStorage`，社區據點無網路也能玩抽牌、任務、祝福牆
- **一鍵部署** — 推上 `main` 分支自動發到 GitHub Pages

## 技術棧

純 HTML / CSS / Vanilla JS，無 build step。

| 功能 | 預設（GH Pages 直接能跑） | 進階可選 |
|------|---------------------------|---------|
| TTS 朗讀 | 瀏覽器內建 `speechSynthesis` | Edge TTS 曉臻（要後端） |
| STT 語音輸入 | 瀏覽器內建 `webkitSpeechRecognition` | Groq Whisper（要後端） |
| 對話生成 | 規則式 + 隨機回應 | Claude API（要後端） |

## 快速啟動

### 本機預覽（純前端）

```bash
python3 -m http.server 8000
# http://localhost:8000
```

### 部署到 GitHub Pages

1. 把這個專案推到 GitHub
2. Repo Settings → Pages → Source 選 **GitHub Actions**
3. push 到 `main` 分支，`.github/workflows/pages.yml` 會自動部署
4. 部署完成後即可在 `https://<你的帳號>.github.io/<repo名>/` 訪問

## 進階：啟用 Groq Whisper / Edge TTS

當社區實測發現內建辨識率不夠時，可以加一台後端代理：

```bash
cd server
npm install
GROQ_API_KEY=gsk_xxx node proxy.js
```

然後在 `scripts/config.js` 解開：

```js
window.GROQ_PROXY_URL = '/api/transcribe';     // 或 https://your-backend/api/transcribe
window.EDGE_TTS_URL = '/api/tts';
window.EDGE_TTS_VOICE = 'zh-TW-HsiaoChenNeural';
```

代理可部署在 Cloudflare Workers / Vercel / Railway / 自己的 VPS，前端維持在 GH Pages。

## 資料儲存

全部在瀏覽器 `localStorage`：

- `tarot.wishes` — 祝福牆內容
- `tarot.tasks` — 今天的任務清單
- `tarot.history` — 抽牌紀錄（最近 30 張）
- `tarot.fontSize` — 字體偏好
- `tarot.voiceOn` — 語音開關

清除瀏覽器資料會一併清掉以上紀錄。

## 後續路線圖

- [ ] 串接 Claude API 提供更自然的牌義解讀與對話（後端 `/api/chat`）
- [ ] 跨世代陪伴模式：青年志工協助操作畫面
- [ ] 家屬端：可遠端關心長者今日抽到什麼牌、做了哪些任務
- [ ] 社區管理面板：彙整祝福牆內容做成週報

## 授權

MIT
