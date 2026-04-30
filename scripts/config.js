// 站台設定
//
// 【TTS 朗讀】
// 預設使用瀏覽器內建 speechSynthesis（免費、零依賴）。
// 想換成 Edge TTS 曉臻（音質更好，但需要 server/proxy.js）時，把下面三行解開：
// window.EDGE_TTS_URL = '/api/tts';
// window.EDGE_TTS_VOICE = 'zh-TW-HsiaoChenNeural';
// window.EDGE_TTS_RATE = '-10%';
//
// 【STT 語音輸入】
// 預設使用瀏覽器內建 webkitSpeechRecognition（免費、GH Pages 可跑）。
// 想換成 Groq Whisper（音質更穩，但需要 server/proxy.js）時，把下面兩行解開：
// window.GROQ_PROXY_URL = '/api/transcribe';
// window.GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';

// 未來若要讓對話走 Claude，提供同站代理：
// window.CLAUDE_PROXY_URL = '/api/chat';
