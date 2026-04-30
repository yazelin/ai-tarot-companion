// AI 對話模組
// 目前以規則式 + 隨機 fallback 實作；保留 askClaude() 介面，未來可換成 Claude API。
window.AIChat = (() => {
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function moodReply(mood) {
    const list = window.MOOD_RESPONSES[mood];
    return list ? pick(list) : pick(window.GENERIC_REPLIES);
  }

  function freeTextReply(text) {
    const lower = (text || '').toLowerCase();
    for (const rule of window.KEYWORD_RESPONSES) {
      if (rule.keys.some(k => lower.includes(k))) return rule.reply;
    }
    return pick(window.GENERIC_REPLIES);
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return pick(window.GREETINGS.morning);
    if (h < 18) return pick(window.GREETINGS.afternoon);
    return pick(window.GREETINGS.evening);
  }

  // 預留：未來呼叫 Claude API 取代 freeTextReply
  // 使用方式（未來）：
  //   const reply = await AIChat.askClaude({ message, history });
  // 後端需提供 /api/chat 代理（避免在前端暴露金鑰）
  async function askClaude({ message, history = [] } = {}) {
    if (!window.CLAUDE_PROXY_URL) {
      // 尚未設定後端代理 → 退回規則式
      return freeTextReply(message);
    }
    try {
      const res = await fetch(window.CLAUDE_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          system: '你是一位溫暖、耐心、專為長者設計的陪伴者。請使用簡單的繁體中文，避免艱澀詞彙，每段話不超過兩句。'
        })
      });
      if (!res.ok) throw new Error('proxy error');
      const data = await res.json();
      return data.reply || freeTextReply(message);
    } catch (e) {
      console.warn('askClaude failed, falling back:', e);
      return freeTextReply(message);
    }
  }

  // ---------- Groq Whisper 語音辨識 ----------
  // 使用後端代理（建議）：window.GROQ_PROXY_URL = '/api/transcribe'
  // 或直連（僅開發/示範）：window.GROQ_API_KEY = 'gsk_...'，model 可覆寫 window.GROQ_WHISPER_MODEL
  async function transcribeWithGroq(blob, { language = 'zh' } = {}) {
    if (!blob) throw new Error('沒有錄到聲音');

    const proxy = window.GROQ_PROXY_URL;
    const directKey = window.GROQ_API_KEY;
    const model = window.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo';

    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', model);
    if (language) form.append('language', language);
    form.append('response_format', 'json');

    let url, headers = {};
    if (proxy) {
      url = proxy;
    } else if (directKey) {
      url = 'https://api.groq.com/openai/v1/audio/transcriptions';
      headers.Authorization = `Bearer ${directKey}`;
    } else {
      throw new Error('尚未設定 GROQ_PROXY_URL 或 GROQ_API_KEY');
    }

    const res = await fetch(url, { method: 'POST', headers, body: form });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Groq 辨識失敗 (${res.status}) ${errText}`);
    }
    const data = await res.json();
    return (data.text || '').trim();
  }

  return { moodReply, freeTextReply, greeting, askClaude, transcribeWithGroq };
})();
