// AI 塔羅心靈陪伴站 — Cloudflare Worker 後端
// 端點：
//   POST /chat        對話：Groq → OpenRouter → Gemini → 規則式
//   POST /transcribe  語音辨識：Groq Whisper（multipart 直接轉發）
//   GET  /health      健康檢查
//
// 機密：在 dashboard 或 wrangler secret 設定
//   GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY（任一都可，越多越穩）

import * as OpenCC from 'opencc-js/cn2t';

// 簡轉繁（台灣慣用詞 s2twp）— 全域快取，每次冷啟動只建一次
let _s2tw = null;
function toTraditional(s) {
  if (!s) return s;
  if (!_s2tw) _s2tw = OpenCC.Converter({ from: 'cn', to: 'twp' });
  return _s2tw(s);
}

const SYSTEM_PROMPT = `你是社區據點的 AI 陪伴員，名字叫「小溫」。陪伴對象是 65-90 歲的台灣長者。

【說話風格】
- 一律用繁體中文，避免英文、艱深詞彙、流行語
- 每次回應 1-2 句、總共不超過 50 字
- 像鄰居姪女的口氣，不要太正式
- 多問開放式問題，引導對方多說一點
- 適度使用 1 個表情符號就好，不要堆砌

【絕對不要做的事】
- 不給醫療診斷或藥物建議；引導他們找家人、看醫生
- 不討論政治、宗教、投資爭議
- 不假裝自己是真人

【遇到嚴重情況】
- 若用戶提到嚴重憂鬱、想不開、身體劇烈不適 → 溫柔但堅定地建議聯絡家人或撥安心專線 1925`;

function corsHeaders(origin, allowed) {
  const list = (allowed || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = list.includes(origin) || list.includes('*');
  return {
    'Access-Control-Allow-Origin': ok ? origin : list[0] || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}

// ---------- LLM Providers ----------
async function callGroq(messages, env) {
  if (!env.GROQ_API_KEY) return null;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.DEFAULT_LLM_MODEL || 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 200,
      temperature: 0.8
    })
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function callOpenRouter(messages, env) {
  if (!env.OPENROUTER_API_KEY) return null;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://yazelin.github.io/ai-tarot-companion',
      'X-Title': 'AI Tarot Companion'
    },
    body: JSON.stringify({
      model: 'qwen/qwen-2.5-72b-instruct:free',
      messages,
      max_tokens: 200,
      temperature: 0.8
    })
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function callGemini(messages, env) {
  if (!env.GEMINI_API_KEY) return null;
  // 把 OpenAI 格式轉成 Gemini 格式
  const system = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: 200, temperature: 0.8 }
    })
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

// ---------- /chat ----------
async function handleChat(req, env, corsH) {
  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'invalid json' }, 400, corsH); }

  const message = (body.message || '').trim();
  if (!message) return json({ error: 'message required' }, 400, corsH);
  if (message.length > 500) return json({ error: 'message too long' }, 400, corsH);

  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const lastCard = body.lastCard ? `（剛抽到的牌：${body.lastCard}）` : '';
  const recentMood = body.recentMood ? `（最近的情緒：${body.recentMood}）` : '';
  const ctxLine = (lastCard + recentMood).trim();

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + (ctxLine ? `\n\n【今天的脈絡】${ctxLine}` : '') },
    ...history.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text })),
    { role: 'user', content: message }
  ];

  // Fallback chain
  const providers = [
    { name: 'groq', fn: callGroq },
    { name: 'openrouter', fn: callOpenRouter },
    { name: 'gemini', fn: callGemini }
  ];

  for (const p of providers) {
    try {
      const reply = await p.fn(messages, env);
      if (reply) return json({ reply: toTraditional(reply), provider: p.name }, 200, corsH);
    } catch (e) {
      console.warn(`${p.name} failed:`, e.message);
    }
  }
  return json({ error: 'all providers failed' }, 502, corsH);
}

// ---------- /transcribe ----------
async function handleTranscribe(req, env, corsH) {
  if (!env.GROQ_API_KEY) return json({ error: 'GROQ_API_KEY not set' }, 500, corsH);

  // 直接把 multipart body 轉發給 Groq Whisper
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    return json({ error: 'expected multipart/form-data' }, 400, corsH);
  }

  // 重組 form data，加上 model 與 language（如果使用者沒帶）
  const inForm = await req.formData();
  const out = new FormData();
  for (const [k, v] of inForm.entries()) out.append(k, v);
  if (!out.get('model')) out.append('model', env.DEFAULT_WHISPER_MODEL || 'whisper-large-v3-turbo');
  if (!out.get('language')) out.append('language', 'zh');
  if (!out.get('prompt')) out.append('prompt', '以下是台灣長者的口語對話，請用繁體中文輸出。');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}` },
    body: out
  });

  // Whisper 偶爾吐簡體 → 在 server 端統一轉繁
  if (res.ok) {
    try {
      const data = await res.json();
      if (data.text) data.text = toTraditional(data.text);
      return json(data, 200, corsH);
    } catch {
      /* fallback to passthrough */
    }
  }
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsH }
  });
}

// ---------- Router ----------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';
    const corsH = corsHeaders(origin, env.ALLOWED_ORIGINS);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });

    if (req.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        providers: {
          groq: !!env.GROQ_API_KEY,
          openrouter: !!env.OPENROUTER_API_KEY,
          gemini: !!env.GEMINI_API_KEY
        }
      }, 200, corsH);
    }
    if (req.method === 'POST' && url.pathname === '/chat') return handleChat(req, env, corsH);
    if (req.method === 'POST' && url.pathname === '/transcribe') return handleTranscribe(req, env, corsH);

    return json({ error: 'not found' }, 404, corsH);
  }
};
