// AI 塔羅心靈陪伴站 — 後端代理
// 提供：
//   POST /api/transcribe   →  轉送到 Groq Whisper
//   POST /api/tts          →  Edge TTS 曉臻，回傳 audio/mpeg
//   GET  /*                →  靜態檔（serve 上一層的 index.html）
//
// 需要環境變數：
//   GROQ_API_KEY            Groq API 金鑰
//   PORT                    （選）預設 8765
//
// 啟動：cd server && npm install && GROQ_API_KEY=xxx npm start

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8765);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const buf = await readBody(req);
  return JSON.parse(buf.toString('utf8') || '{}');
}

// ---------- /api/tts ----------
async function ttsToBuffer({ text, voice = 'zh-TW-HsiaoChenNeural', rate = '-10%' }) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const stream = tts.toStream(text, { rate });
  return await new Promise((resolve, reject) => {
    const parts = [];
    stream.audioStream.on('data', d => parts.push(d));
    stream.audioStream.on('end', () => resolve(Buffer.concat(parts)));
    stream.audioStream.on('error', reject);
  });
}

async function handleTTS(req, res) {
  try {
    const body = await readJson(req);
    if (!body.text) return send(res, 400, 'missing text');
    const audio = await ttsToBuffer(body);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Cache-Control': 'no-store'
    });
    res.end(audio);
  } catch (e) {
    console.error('tts error:', e);
    send(res, 500, 'tts failed');
  }
}

// ---------- /api/transcribe ----------
async function handleTranscribe(req, res) {
  if (!GROQ_API_KEY) return send(res, 500, 'GROQ_API_KEY 未設定');
  try {
    // 直接把 multipart body 連同 content-type 一起轉送給 Groq
    const buf = await readBody(req);
    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': req.headers['content-type'] || 'multipart/form-data'
      },
      body: buf
    });
    const text = await groqRes.text();
    res.writeHead(groqRes.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(text);
  } catch (e) {
    console.error('transcribe error:', e);
    send(res, 500, 'transcribe failed');
  }
}

// ---------- 靜態檔 ----------
async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'forbidden');
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) return send(res, 404, 'not found');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    send(res, 404, 'not found');
  }
}

// ---------- Router ----------
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/tts') return handleTTS(req, res);
  if (req.method === 'POST' && req.url === '/api/transcribe') return handleTranscribe(req, res);
  if (req.method === 'GET') return serveStatic(req, res);
  send(res, 405, 'method not allowed');
});

server.listen(PORT, () => {
  console.log(`🌷 AI 塔羅陪伴站啟動於 http://localhost:${PORT}`);
  console.log(`   Whisper: ${GROQ_API_KEY ? 'enabled (' + GROQ_MODEL + ')' : 'disabled (set GROQ_API_KEY)'}`);
  console.log(`   Edge TTS: zh-TW-HsiaoChenNeural`);
});
