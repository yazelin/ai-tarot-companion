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

const SYSTEM_PROMPT = `你是社區據點的 AI 陪伴員，名字叫「亞澤」。陪伴對象是 65-90 歲的台灣長者。
若有人問你叫什麼名字，告訴他：「我是亞澤」。

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

// ---------- /tts (Edge TTS via WebSocket) ----------
const EDGE_TTS_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';

function escapeXml(s) {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

// MS 自 2024 年開始要求 Sec-MS-GEC token：SHA256(WinFileTime + TrustedClientToken)
async function secMsGecToken() {
  const TICKS_PER_SECOND = 10000000n;
  const WIN_EPOCH = 11644473600n;
  const ROUND = 3000000000n;            // 5 分鐘
  const now = BigInt(Math.floor(Date.now() / 1000));
  let ticks = (now + WIN_EPOCH) * TICKS_PER_SECOND;
  ticks -= ticks % ROUND;
  const data = `${ticks}${EDGE_TTS_TOKEN}`;
  const buf = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function edgeTTS(text, voice, rate, pitch) {
  const reqId = crypto.randomUUID().replace(/-/g, '').toUpperCase();
  // CF Workers fetch 不接受 wss://，要用 https:// 加 Upgrade header
  const gec = await secMsGecToken();
  const wsUrl = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TTS_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${reqId}`;

  const wsResp = await fetch(wsUrl, {
    headers: {
      'Upgrade': 'websocket',
      'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/130.0.0.0',
      'Sec-MS-GEC': gec,
      'Sec-MS-GEC-Version': '1-130.0.2849.68',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  if (wsResp.status !== 101) {
    const errText = await wsResp.text().catch(() => '');
    throw new Error(`upgrade failed ${wsResp.status}: ${errText.slice(0, 100)}`);
  }
  const ws = wsResp.webSocket;
  if (!ws) throw new Error('no webSocket on response');
  ws.accept();

  const ts = new Date().toISOString();
  // 1) speech.config
  ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
    `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);

  // 2) SSML
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-TW'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
  ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`);

  // 3) 收訊 — text 訊息含元資料；binary 訊息頭 2 byte 是 header length（big-endian）
  const chunks = [];
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { try { ws.close(); } catch (_) {} reject(new Error('tts timeout')); }, 30000);
    ws.addEventListener('message', (event) => {
      const d = event.data;
      if (typeof d === 'string') {
        if (d.includes('Path:turn.end')) {
          clearTimeout(timeout);
          try { ws.close(); } catch (_) {}
          resolve();
        }
      } else {
        // ArrayBuffer
        const view = new DataView(d);
        const headerLen = view.getUint16(0, false);   // big-endian
        const audioBytes = new Uint8Array(d, 2 + headerLen);
        if (audioBytes.length) chunks.push(audioBytes);
      }
    });
    ws.addEventListener('close', () => { clearTimeout(timeout); resolve(); });
    ws.addEventListener('error', (e) => { clearTimeout(timeout); reject(new Error('ws error')); });
  });

  // 串接所有片段
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function handleTTS(req, env, corsH) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400, corsH); }
  const text = (body.text || '').trim().slice(0, 1000);
  const voice = body.voice || 'zh-TW-YunJheNeural';
  const rate = body.rate || '-10%';
  const pitch = body.pitch || '+0Hz';
  if (!text) return json({ error: 'text required' }, 400, corsH);

  try {
    const audio = await edgeTTS(text, voice, rate, pitch);
    return new Response(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        ...corsH
      }
    });
  } catch (e) {
    console.error('tts error:', e);
    return json({ error: 'tts failed: ' + e.message }, 502, corsH);
  }
}

// ---------- /wishes ----------
async function listWishes(req, env, corsH) {
  if (!env.DB) return json({ wishes: [] }, 200, corsH);
  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50'), 1), 200);
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, text, created_at FROM wishes WHERE hidden=0 ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();
    return json({ wishes: results || [] }, 200, corsH);
  } catch (e) {
    console.error('listWishes error:', e);
    return json({ error: 'db error' }, 500, corsH);
  }
}

async function createWish(req, env, corsH) {
  if (!env.DB) return json({ error: 'DB not configured' }, 500, corsH);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400, corsH); }

  const text = (body.text || '').trim().slice(0, 200);
  let name = (body.name || '').trim().slice(0, 20);
  if (!text || text.length < 1) return json({ error: 'text required' }, 400, corsH);
  if (!name) name = '匿名';

  // 統一用繁體存
  const safeText = toTraditional(text);
  const safeName = toTraditional(name);

  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    await env.DB.prepare(
      'INSERT INTO wishes (id, name, text, created_at) VALUES (?, ?, ?, ?)'
    ).bind(id, safeName, safeText, now).run();
    return json({ wish: { id, name: safeName, text: safeText, created_at: now } }, 201, corsH);
  } catch (e) {
    console.error('createWish error:', e);
    return json({ error: 'db error' }, 500, corsH);
  }
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
    if (req.method === 'POST' && url.pathname === '/tts') return handleTTS(req, env, corsH);
    if (req.method === 'GET'  && url.pathname === '/wishes') return listWishes(req, env, corsH);
    if (req.method === 'POST' && url.pathname === '/wishes') return createWish(req, env, corsH);

    return json({ error: 'not found' }, 404, corsH);
  }
};
