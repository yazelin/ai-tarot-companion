// 語音模組 — 朗讀（speechSynthesis）+ 錄音（MediaRecorder）+ 辨識（Groq Whisper）
window.VoiceService = (() => {
  const state = {
    enabled: true,
    voice: null,
    rate: 0.95,
    pitch: 1.0,
    recorder: null,
    chunks: [],
    stream: null
  };

  // ---------- 朗讀 ----------
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    return (
      voices.find(v => v.lang === 'zh-TW' && /female|woman/i.test(v.name)) ||
      voices.find(v => v.lang === 'zh-TW') ||
      voices.find(v => v.lang === 'zh-CN') ||
      voices.find(v => v.lang.startsWith('zh')) ||
      voices[0]
    );
  }

  // 預設使用 Edge TTS 曉臻；若沒設定 EDGE_TTS_URL 就退回瀏覽器內建
  let ttsAudio = null;
  let ttsAbort = null;

  async function speakWithEdge(text) {
    const url = window.EDGE_TTS_URL; // e.g. '/api/tts'
    const voice = window.EDGE_TTS_VOICE || 'zh-TW-HsiaoChenNeural';
    const rate = window.EDGE_TTS_RATE || '-10%'; // 對長者放慢一點
    if (!url) return false;

    if (ttsAbort) ttsAbort.abort();
    ttsAbort = new AbortController();

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, rate }),
        signal: ttsAbort.signal
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      if (ttsAudio) { ttsAudio.pause(); ttsAudio.src = ''; }
      ttsAudio = new Audio(audioUrl);
      ttsAudio.onended = () => URL.revokeObjectURL(audioUrl);
      await ttsAudio.play();
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('Edge TTS 失敗，改用瀏覽器內建:', e);
      return false;
    }
  }

  function speakWithBrowser(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    state.voice = state.voice || pickVoice();
    text.split(/(?<=[。！？.!?])/).filter(s => s.trim()).forEach(s => {
      const u = new SpeechSynthesisUtterance(s.trim());
      if (state.voice) u.voice = state.voice;
      u.lang = 'zh-TW';
      u.rate = state.rate;
      u.pitch = state.pitch;
      speechSynthesis.speak(u);
    });
  }

  async function speak(text) {
    if (!state.enabled || !text) return;
    stop();
    const ok = await speakWithEdge(text);
    if (!ok) speakWithBrowser(text);
  }

  function stop() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (ttsAbort) { ttsAbort.abort(); ttsAbort = null; }
    if (ttsAudio) { try { ttsAudio.pause(); } catch (_) {} ttsAudio.src = ''; ttsAudio = null; }
  }

  function toggle() {
    state.enabled = !state.enabled;
    if (!state.enabled) stop();
    return state.enabled;
  }

  function isEnabled() { return state.enabled; }

  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => { state.voice = pickVoice(); };
  }

  // ---------- 錄音（給 Groq Whisper 用） ----------
  function isRecordingSupported() {
    return !!(navigator.mediaDevices && window.MediaRecorder);
  }

  function isRecording() {
    return !!state.recorder && state.recorder.state === 'recording';
  }

  // 選擇瀏覽器支援、Groq 也吃得下的格式
  function pickMime() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    for (const m of candidates) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  async function startRecording() {
    if (!isRecordingSupported()) throw new Error('此裝置不支援錄音');
    if (isRecording()) return;
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMime();
    state.recorder = new MediaRecorder(state.stream, mime ? { mimeType: mime } : undefined);
    state.chunks = [];
    state.recorder.ondataavailable = (e) => { if (e.data && e.data.size) state.chunks.push(e.data); };
    state.recorder.start();
  }

  // 停止錄音 → 回傳 Blob
  function stopRecording() {
    return new Promise((resolve, reject) => {
      if (!state.recorder) return reject(new Error('沒有正在進行的錄音'));
      const mime = state.recorder.mimeType || 'audio/webm';
      state.recorder.onstop = () => {
        const blob = new Blob(state.chunks, { type: mime });
        state.chunks = [];
        if (state.stream) state.stream.getTracks().forEach(t => t.stop());
        state.stream = null;
        state.recorder = null;
        resolve(blob);
      };
      state.recorder.onerror = (e) => reject(e.error || e);
      state.recorder.stop();
    });
  }

  function cancelRecording() {
    try { if (state.recorder) state.recorder.stop(); } catch (_) {}
    if (state.stream) state.stream.getTracks().forEach(t => t.stop());
    state.recorder = null;
    state.stream = null;
    state.chunks = [];
  }

  // ---------- 瀏覽器內建辨識（webkitSpeechRecognition） ----------
  function isWebSpeechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function startWebSpeech({ onResult, onError, onEnd } = {}) {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { onError && onError(new Error('此瀏覽器不支援語音輸入')); return null; }
    const r = new Rec();
    r.lang = 'zh-TW';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => onResult && onResult(e.results[0][0].transcript);
    r.onerror = (e) => onError && onError(e);
    r.onend = () => onEnd && onEnd();
    r.start();
    return r;
  }

  // 對外提供「目前該用哪條語音輸入路徑」
  function preferredSTT() {
    if (window.GROQ_PROXY_URL || window.GROQ_API_KEY) return 'groq';
    if (isWebSpeechSupported()) return 'webspeech';
    return 'none';
  }

  return {
    speak, stop, toggle, isEnabled,
    isRecordingSupported, isRecording,
    startRecording, stopRecording, cancelRecording,
    isWebSpeechSupported, startWebSpeech, preferredSTT
  };
})();
