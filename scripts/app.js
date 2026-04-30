(() => {
  'use strict';

  const STORAGE_KEYS = {
    wishes: 'tarot.wishes',
    tasks: 'tarot.tasks',
    history: 'tarot.history',
    fontSize: 'tarot.fontSize',
    voiceOn: 'tarot.voiceOn'
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- 畫面切換 ----------
  function showScreen(name) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
    const back = $('#navBack');
    if (back) back.hidden = (name === 'home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name !== 'chat') VoiceService.stop();
    if (name === 'task') renderTasks();
    if (name === 'wish') renderWishes();
    if (name === 'tarot') resetTarotStage();
  }

  // ---------- AI 連線狀態 ----------
  function setAIStatus(state, label) {
    const el = $('#aiStatus');
    if (!el) return;
    el.className = `brand-status ${state}`;
    el.querySelector('.label').textContent = label;
    const titles = {
      online: 'AI 連線中：智慧對話可用',
      offline: '離線模式：對話走規則式回覆',
      error: '連線失敗：請檢查網路',
      checking: '檢查中…'
    };
    el.title = titles[state] || '';
  }

  async function checkAIStatus() {
    const url = window.CHAT_API_URL;
    if (!url) { setAIStatus('offline', '離線模式'); return; }
    try {
      const healthUrl = url.replace(/\/chat$/, '/health');
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(healthUrl, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('health bad');
      const data = await res.json();
      const anyUp = data.providers && Object.values(data.providers).some(Boolean);
      if (anyUp) setAIStatus('online', 'AI 連線中');
      else setAIStatus('offline', '離線模式');
    } catch {
      setAIStatus('error', '連線失敗');
    }
  }

  // ---------- Toast ----------
  function toast(text, ms = 2000) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ---------- 字體 ----------
  function applyFontSize(size) {
    document.documentElement.dataset.fontsize = size;
    localStorage.setItem(STORAGE_KEYS.fontSize, size);
  }

  function cycleFontSize() {
    const cur = document.documentElement.dataset.fontsize || 'normal';
    const next = cur === 'normal' ? 'large' : cur === 'large' ? 'xlarge' : 'normal';
    applyFontSize(next);
    toast(`字體：${next === 'normal' ? '一般' : next === 'large' ? '大' : '特大'}`);
  }

  // ---------- 語音 ----------
  function syncVoiceButton() {
    const btn = $('#voiceToggle');
    const on = VoiceService.isEnabled();
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.querySelector('.label').textContent = on ? '語音開' : '語音關';
    btn.querySelector('.icon').textContent = on ? '🔊' : '🔇';
  }

  // ---------- 塔羅 ----------
  let lastCard = null;

  function drawCard() {
    const deck = window.TAROT_DECK;
    let card;
    let tries = 0;
    do {
      card = deck[Math.floor(Math.random() * deck.length)];
      tries++;
    } while (lastCard && card.id === lastCard.id && tries < 5);
    lastCard = card;

    $('#cardImage').textContent = card.emoji;
    $('#cardName').textContent = `${card.name} ${card.nameEn}`;
    $('#readingHeadline').textContent = card.headline;
    $('#readingBody').textContent = card.body;

    $('#cardBack').style.display = 'none';
    $('#drawBtn').style.display = 'none';
    $('#tarotResult').classList.remove('hidden');

    saveHistory(card);
    VoiceService.speak(`${card.name}。${card.headline} ${card.body}`);
  }

  function resetTarotStage() {
    $('#cardBack').style.display = 'flex';
    $('#drawBtn').style.display = 'inline-flex';
    $('#tarotResult').classList.add('hidden');
    VoiceService.stop();
  }

  function saveHistory(card) {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]');
      list.unshift({ id: card.id, name: card.name, ts: Date.now() });
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(list.slice(0, 30)));
    } catch (_) {}
  }

  // ---------- 聊天 ----------
  function appendBubble(side, text) {
    const wrap = document.createElement('div');
    wrap.className = `chat-bubble ${side}`;
    const senderName = side === 'user' ? '您' : '亞澤';
    const avatarEmoji = side === 'user' ? '🧓' : '🌷';
    wrap.innerHTML = `
      <div class="avatar">${avatarEmoji}</div>
      <div class="bubble-body">
        <div class="sender"></div>
        <div class="text"></div>
      </div>
    `;
    wrap.querySelector('.sender').textContent = senderName;
    wrap.querySelector('.text').textContent = text;
    const log = $('#chatLog');
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  // 把聊天歷史轉成 worker 想要的格式（最多 6 輪）
  function recentChatHistory() {
    return $$('.chat-bubble').slice(-6).map(b => ({
      role: b.classList.contains('user') ? 'user' : 'ai',
      text: b.querySelector('.text')?.textContent || ''
    }));
  }

  async function sendUserMessage(text) {
    if (!text || !text.trim()) return;
    appendBubble('user', text.trim());
    $('#chatText').value = '';
    await new Promise(r => setTimeout(r, 200));
    const result = await AIChat.askClaude({
      message: text,
      history: recentChatHistory(),
      lastCard: lastCard?.name || null,
      recentMood: lastMood || null
    });
    appendBubble('ai', result.reply);
    VoiceService.speak(result.reply);
    setAIStatus(result.from === 'ai' ? 'online' : 'error',
                result.from === 'ai' ? 'AI 連線中' : '連線失敗');
  }

  let lastMood = null;

  async function handleMood(mood) {
    lastMood = mood;
    appendBubble('user', `今天感覺：${mood}`);
    // 若有 Worker 後端 → 用 LLM 回覆，能延續上下文；否則退回規則式
    if (window.CHAT_API_URL || window.CLAUDE_PROXY_URL) {
      await new Promise(r => setTimeout(r, 200));
      const result = await AIChat.askClaude({
        message: `我今天感覺有點${mood}`,
        history: recentChatHistory(),
        lastCard: lastCard?.name || null,
        recentMood: mood
      });
      appendBubble('ai', result.reply);
      VoiceService.speak(result.reply);
      setAIStatus(result.from === 'ai' ? 'online' : 'error',
                  result.from === 'ai' ? 'AI 連線中' : '連線失敗');
    } else {
      const reply = AIChat.moodReply(mood);
      setTimeout(() => { appendBubble('ai', reply); VoiceService.speak(reply); }, 250);
    }
  }

  // ---------- 今日任務 ----------
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function loadTasks() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || '{}');
      if (raw.day !== todayKey()) return null;
      return raw.items || [];
    } catch (_) { return null; }
  }

  function saveTasks(items) {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify({ day: todayKey(), items }));
  }

  function generateDailyTasks() {
    const deck = window.TAROT_DECK.slice();
    deck.sort(() => Math.random() - 0.5);
    return deck.slice(0, 3).map(c => ({
      emoji: c.task.emoji,
      text: c.task.text,
      from: c.name,
      done: false
    }));
  }

  function renderTasks() {
    let items = loadTasks();
    if (!items) {
      items = generateDailyTasks();
      saveTasks(items);
    }
    const list = $('#taskList');
    list.innerHTML = '';
    items.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = `task-item${item.done ? ' done' : ''}`;
      el.innerHTML = `
        <span class="task-emoji">${item.emoji}</span>
        <span class="task-text"></span>
        <button class="task-check" aria-label="完成" data-idx="${idx}">${item.done ? '✓' : ''}</button>
      `;
      el.querySelector('.task-text').textContent = `${item.text}（來自：${item.from}）`;
      el.querySelector('.task-check').addEventListener('click', () => {
        items[idx].done = !items[idx].done;
        saveTasks(items);
        renderTasks();
        if (items[idx].done) {
          toast('您好棒！繼續加油 👏');
          VoiceService.speak('您好棒！繼續加油');
        }
      });
      list.appendChild(el);
    });
  }

  function addTaskFromCard() {
    if (!lastCard) return;
    const items = loadTasks() || [];
    if (items.find(i => i.text === lastCard.task.text)) {
      toast('這個任務已經在今天的清單裡了');
      return;
    }
    items.push({ ...lastCard.task, from: lastCard.name, done: false });
    saveTasks(items);
    renderTasks();
    toast('已加入今天的小任務 ✅');
  }

  // ---------- 祝福牆 ----------
  const WISH_COLORS = ['#ffe1e1', '#ffe9c7', '#fffac2', '#d8f3dc', '#cfeafd', '#e8d6ff'];

  function loadWishes() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.wishes) || '[]'); }
    catch (_) { return []; }
  }

  function saveWish(wish) {
    const list = loadWishes();
    list.unshift(wish);
    localStorage.setItem(STORAGE_KEYS.wishes, JSON.stringify(list.slice(0, 100)));
  }

  function seedWishesIfEmpty() {
    if (loadWishes().length) return;
    const seeds = [
      { name: '阿美阿嬤', text: '希望大家身體都健健康康！', ts: Date.now() - 86400000 },
      { name: '老王', text: '祝孫子今年考試順利', ts: Date.now() - 7200000 },
      { name: '春枝', text: '今天天氣很好，謝謝老天爺', ts: Date.now() - 3600000 },
      { name: '阿福', text: '希望我太太膝蓋早點不痛', ts: Date.now() - 1800000 }
    ];
    localStorage.setItem(STORAGE_KEYS.wishes, JSON.stringify(seeds));
  }

  function renderWishes() {
    const wall = $('#wishWall');
    wall.innerHTML = '';
    loadWishes().forEach((w, i) => {
      const card = document.createElement('div');
      card.className = 'wish-card';
      card.style.background = WISH_COLORS[i % WISH_COLORS.length];
      card.style.setProperty('--rot', `${(i % 5 - 2) * 1.2}deg`);
      card.innerHTML = `<div class="body"></div><div class="signature"></div>`;
      card.querySelector('.body').textContent = w.text;
      card.querySelector('.signature').textContent = w.name ? `— ${w.name}` : '';
      wall.appendChild(card);
    });
  }

  function submitWish() {
    const name = ($('#wishName').value || '').trim();
    const text = ($('#wishText').value || '').trim();
    if (!text) {
      toast('請先寫下您的祝福喔');
      return;
    }
    saveWish({ name: name || '匿名', text, ts: Date.now() });
    $('#wishName').value = '';
    $('#wishText').value = '';
    renderWishes();
    toast('已貼上祝福牆 💝');
    VoiceService.speak('謝謝您的祝福，已經貼上去了');
  }

  // ---------- 麥克風（Groq Whisper） ----------
  let micBusy = false;

  function setMicUI(mode) {
    const btn = $('#micBtn');
    btn.classList.toggle('primary', mode === 'recording');
    const map = {
      recording: ['🔴', '正在聽… 點一下結束'],
      thinking: ['⏳', '辨識中…'],
      idle: ['🎤', '按一下說話']
    };
    const [emoji, text] = map[mode] || map.idle;
    btn.innerHTML = `<span class="emoji">${emoji}</span><span class="btn-text"> ${text}</span>`;
  }

  let webRec = null;

  async function toggleMic() {
    if (micBusy) return;
    const mode = VoiceService.preferredSTT();

    if (mode === 'none') {
      toast('這台裝置不支援語音輸入，請用打字喔');
      return;
    }

    // ---- 內建 webkitSpeechRecognition ----
    if (mode === 'webspeech') {
      if (webRec) {
        try { webRec.stop(); } catch (_) {}
        return;
      }
      setMicUI('recording');
      toast('請說話… 🎤');
      webRec = VoiceService.startWebSpeech({
        onResult: (text) => { $('#chatText').value = text; sendUserMessage(text); },
        onError: () => toast('沒聽清楚，請再試一次'),
        onEnd: () => { webRec = null; setMicUI('idle'); }
      });
      return;
    }

    // ---- Groq Whisper（需要後端代理） ----
    if (!VoiceService.isRecordingSupported()) {
      toast('這台裝置目前不支援錄音');
      return;
    }
    if (!VoiceService.isRecording()) {
      try {
        await VoiceService.startRecording();
        setMicUI('recording');
        toast('開始錄音 🎤');
      } catch (e) {
        toast('沒辦法開啟麥克風，請確認權限');
        console.warn(e);
      }
      return;
    }
    micBusy = true;
    try {
      setMicUI('thinking');
      const blob = await VoiceService.stopRecording();
      const text = await AIChat.transcribeWithGroq(blob, { language: 'zh' });
      if (!text) { toast('沒聽清楚，請再說一次'); return; }
      $('#chatText').value = text;
      await sendUserMessage(text);
    } catch (e) {
      console.warn(e);
      toast(e.message || '辨識失敗，請再試一次');
    } finally {
      setMicUI('idle');
      micBusy = false;
    }
  }

  // ---------- 事件綁定 ----------
  function bind() {
    // 主選單與導覽
    $$('.menu-card').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.go)));
    $('#navBack').addEventListener('click', () => showScreen('home'));

    // Topbar
    $('#voiceToggle').addEventListener('click', () => { VoiceService.toggle(); syncVoiceButton(); });
    $('#fontToggle').addEventListener('click', cycleFontSize);
    $('#aiStatus').addEventListener('click', () => {
      const cur = $('#aiStatus').className.split(' ')[1] || '';
      const labels = {
        online: '✅ AI 連線中：智慧對話可用',
        offline: '⚠️ 離線模式：對話走規則式回覆',
        error: '❌ 連線失敗：正在重新檢查…',
        checking: '⏳ 檢查中…'
      };
      toast(labels[cur] || '正在檢查…');
      checkAIStatus();
    });

    // 塔羅
    $('#drawBtn').addEventListener('click', drawCard);
    $('#drawAgainBtn').addEventListener('click', () => { resetTarotStage(); drawCard(); });
    $('#readAloudBtn').addEventListener('click', () => {
      if (!lastCard) return;
      VoiceService.speak(`${lastCard.name}。${lastCard.headline} ${lastCard.body}`);
    });
    $('#makeTaskBtn').addEventListener('click', addTaskFromCard);

    // 聊天
    $$('.mood-btn').forEach(b => b.addEventListener('click', () => handleMood(b.dataset.mood)));
    $('#chatSendBtn').addEventListener('click', () => sendUserMessage($('#chatText').value));
    $('#chatText').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendUserMessage($('#chatText').value); }
    });

    // 麥克風（Groq Whisper：點一下開始、點一下結束）
    $('#micBtn').addEventListener('click', toggleMic);

    // 任務
    $('#newTaskBtn').addEventListener('click', () => {
      saveTasks(generateDailyTasks());
      renderTasks();
      toast('換了三個新任務 🎲');
    });

    // 祝福
    $('#wishSubmit').addEventListener('click', submitWish);
  }

  // ---------- 啟動 ----------
  function init() {
    // 還原偏好
    const savedFont = localStorage.getItem(STORAGE_KEYS.fontSize);
    if (savedFont) applyFontSize(savedFont);

    syncVoiceButton();

    // 開場問候
    $('#greeting').textContent = AIChat.greeting();

    // 預設聊天頁第一句 AI 招呼
    appendBubble('ai', '您好，我是亞澤，您的陪伴小幫手。今天感覺怎麼樣呢？您可以按下面的按鈕，或直接打字告訴我。');

    seedWishesIfEmpty();
    renderWishes();
    renderTasks();
    checkAIStatus();

    bind();
  }

  // Service Worker：網路優先，永遠拿最新檔；離線時退回快取
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW failed:', err));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
