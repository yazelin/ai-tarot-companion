// 站台設定
//
// Cloudflare Worker 後端（已部署）
const TAROT_API = 'https://tarot-companion.yazelinj303.workers.dev';
window.CHAT_API_URL    = `${TAROT_API}/chat`;
window.GROQ_PROXY_URL  = `${TAROT_API}/transcribe`;
window.WISHES_API_URL  = `${TAROT_API}/wishes`;

// 【TTS 朗讀】預設用瀏覽器內建 speechSynthesis（免費、零依賴）
// 想換 Edge TTS 曉臻請解開：
// window.EDGE_TTS_URL = '/api/tts';
// window.EDGE_TTS_VOICE = 'zh-TW-HsiaoChenNeural';
// window.EDGE_TTS_RATE = '-10%';
