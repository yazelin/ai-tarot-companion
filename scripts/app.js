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
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name !== 'chat') VoiceService.stop();
    if (name === 'task') renderTasks();
    if (name === 'wish') renderWishes();
    if (name === 'tarot') resetTarotStage();
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
    wrap.innerHTML = `
      <div class="avatar">${side === 'user' ? '🧓' : '🌷'}</div>
      <div class="text"></div>
    `;
    wrap.querySelector('.text').textContent = text;
    const log = $('#chatLog');
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  async function sendUserMessage(text) {
    if (!text || !text.trim()) return;
    appendBubble('user', text.trim());
    $('#chatText').value = '';
    // 模擬 AI 思考時間
    await new Promise(r => setTimeout(r, 350));
    const reply = await AIChat.askClaude({ message: text });
    appendBubble('ai', reply);
    VoiceService.speak(reply);
  }

  function handleMood(mood) {
    appendBubble('user', `今天感覺：${mood}`);
    const reply = AIChat.moodReply(mood);
    setTimeout(() => {
      appendBubble('ai', reply);
      VoiceService.speak(reply);
    }, 350);
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
    const emoji = btn.querySelector('.emoji');
    if (mode === 'recording') {
      btn.innerHTML = '<span class="emoji">🔴</span> 正在聽… 點一下結束';
    } else if (mode === 'thinking') {
      btn.innerHTML = '<span class="emoji">⏳</span> 辨識中…';
    } else {
      btn.innerHTML = '<span class="emoji">🎤</span> 按一下說話';
    }
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
    // 主選單
    $$('.menu-card').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.go)));
    $$('[data-back]').forEach(b => b.addEventListener('click', () => showScreen('home')));

    // Topbar
    $('#voiceToggle').addEventListener('click', () => { VoiceService.toggle(); syncVoiceButton(); });
    $('#fontToggle').addEventListener('click', cycleFontSize);

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
    appendBubble('ai', '您好！我是您的陪伴小幫手。今天感覺怎麼樣呢？您可以按下面的按鈕，或直接打字告訴我。');

    seedWishesIfEmpty();
    renderWishes();
    renderTasks();

    bind();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
