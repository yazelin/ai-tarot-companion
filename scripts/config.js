// 站台設定
//
// 部署 Cloudflare Worker 後（見 worker/README.md），把這兩行的網址改成您的：
// window.CHAT_API_URL = 'https://tarot-companion.<您的帳號>.workers.dev/chat';
// window.GROQ_PROXY_URL = 'https://tarot-companion.<您的帳號>.workers.dev/transcribe';
//
// 沒設定的話：對話走規則式、語音辨識走瀏覽器內建（webkitSpeechRecognition）。

// window.CHAT_API_URL = '';
// window.GROQ_PROXY_URL = '';

// 【TTS 朗讀】預設用瀏覽器內建 speechSynthesis（免費、零依賴）
// 想換 Edge TTS 曉臻請解開：
// window.EDGE_TTS_URL = '/api/tts';
// window.EDGE_TTS_VOICE = 'zh-TW-HsiaoChenNeural';
// window.EDGE_TTS_RATE = '-10%';
