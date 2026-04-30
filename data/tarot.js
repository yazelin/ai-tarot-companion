// 22 張大阿爾克那 — 以長者友善的口吻撰寫，避免艱澀詞彙與負面預測
window.TAROT_DECK = [
  {
    id: 0,
    name: "愚者",
    nameEn: "The Fool",
    emoji: "🌱",
    headline: "保持好奇，每天都是新的開始！",
    body: "今天適合放下擔心，用孩子般的眼睛看世界。也許是吃一口沒嚐過的點心、走一條沒走過的路，小小的新鮮事就會帶來大大的快樂。",
    task: { emoji: "🚶", text: "今天嘗試一件以前沒做過的小事" }
  },
  {
    id: 1,
    name: "魔術師",
    nameEn: "The Magician",
    emoji: "🪄",
    headline: "您比想像中更有力量！",
    body: "您一輩子的智慧與經驗，就是一份送給家人的禮物。今天可以試著把一個小本領教給身邊的人，無論是炒菜、編織還是說故事。",
    task: { emoji: "👵", text: "把一個拿手本領分享給一個人" }
  },
  {
    id: 2,
    name: "女祭司",
    nameEn: "The High Priestess",
    emoji: "🌙",
    headline: "靜下來聽聽自己心裡的聲音。",
    body: "今天不用著急回答任何事。泡一杯熱茶，坐在窗邊，讓心慢慢沉下來。安靜，是給自己最好的禮物。",
    task: { emoji: "🍵", text: "泡一杯茶，靜靜坐 10 分鐘" }
  },
  {
    id: 3,
    name: "皇后",
    nameEn: "The Empress",
    emoji: "🌸",
    headline: "今天適合好好照顧自己。",
    body: "您一直在照顧別人，今天換自己被照顧。穿一件喜歡的衣服、吃一頓喜歡的食物，這些都不是浪費，而是讓自己充滿能量。",
    task: { emoji: "🌷", text: "做一件只為自己開心的事" }
  },
  {
    id: 4,
    name: "皇帝",
    nameEn: "The Emperor",
    emoji: "🏛️",
    headline: "您的安排，總是讓人安心。",
    body: "今天可以把家裡或一天的小事重新排一排，整齊就會帶來舒服。把該做的事先做完，下午就能輕鬆喝杯茶。",
    task: { emoji: "📋", text: "把抽屜或桌面整理 5 分鐘" }
  },
  {
    id: 5,
    name: "教皇",
    nameEn: "The Hierophant",
    emoji: "📖",
    headline: "您的話，是別人最珍貴的故事。",
    body: "今天適合說一段往事給家人或朋友聽。也許是年輕時的趣事、也許是一段風雨。您的人生，就是別人最好的書。",
    task: { emoji: "📞", text: "打電話分享一個往事給家人" }
  },
  {
    id: 6,
    name: "戀人",
    nameEn: "The Lovers",
    emoji: "💖",
    headline: "愛，就藏在小小的問候裡。",
    body: "對在乎的人說一句「謝謝你」或「我想你」，看起來簡單，卻是最暖的語言。今天，把愛說出口吧。",
    task: { emoji: "💌", text: "對一個在乎的人說「謝謝你」" }
  },
  {
    id: 7,
    name: "戰車",
    nameEn: "The Chariot",
    emoji: "🚗",
    headline: "穩穩地走，就會走到想去的地方。",
    body: "今天適合做一件您一直想做、卻一直拖著的小事。一次一步、不用很快，您一定可以的。",
    task: { emoji: "✏️", text: "完成一件拖了很久的小事" }
  },
  {
    id: 8,
    name: "力量",
    nameEn: "Strength",
    emoji: "🦁",
    headline: "溫柔，就是您最大的力量。",
    body: "如果今天遇到讓人不開心的事，深呼吸三下，慢慢來。您不需要用力，溫柔就能化解很多事。",
    task: { emoji: "🌬️", text: "做三次慢慢的深呼吸" }
  },
  {
    id: 9,
    name: "隱者",
    nameEn: "The Hermit",
    emoji: "🕯️",
    headline: "獨處，是給自己充電的時間。",
    body: "今天就算一個人也沒關係，獨處不等於孤單。可以讀一本舊書、看一張老照片，自己跟自己聊聊天。",
    task: { emoji: "📷", text: "翻一張老照片，回想一個美好時刻" }
  },
  {
    id: 10,
    name: "命運之輪",
    nameEn: "Wheel of Fortune",
    emoji: "🎡",
    headline: "好事，正在轉到您身邊！",
    body: "生活就像轉輪，總會有起有落。今天若有什麼小驚喜，請大方收下；若還沒遇到，再等一下，它就快來了。",
    task: { emoji: "🎁", text: "今天接受一個小幫忙或讚美" }
  },
  {
    id: 11,
    name: "正義",
    nameEn: "Justice",
    emoji: "⚖️",
    headline: "對自己誠實，就會心安。",
    body: "今天適合做一個小決定。不用想得太複雜，問問自己：哪一個讓心裡比較舒服？跟著感覺走，常常就是對的。",
    task: { emoji: "✅", text: "做一個讓自己心安的小決定" }
  },
  {
    id: 12,
    name: "吊人",
    nameEn: "The Hanged Man",
    emoji: "🌿",
    headline: "慢一點，看到的會更多。",
    body: "今天不用趕。坐下來看看窗外的雲、聽聽鳥叫，平常忽略的小事，其實都是禮物。",
    task: { emoji: "🪟", text: "看窗外發呆 5 分鐘" }
  },
  {
    id: 13,
    name: "節制",
    nameEn: "Temperance",
    emoji: "🌊",
    headline: "剛剛好，就是最好。",
    body: "吃飯七分飽、走路慢慢來、心情平平的，這就是健康的秘訣。今天讓一切都「剛剛好」就行。",
    task: { emoji: "💧", text: "今天多喝兩杯水" }
  },
  {
    id: 14,
    name: "星星",
    nameEn: "The Star",
    emoji: "⭐",
    headline: "別擔心，美好的事情正在靠近您！",
    body: "就算最近有點累，也請相信明天會更好。星星總在最暗的夜晚最亮，您也是。",
    task: { emoji: "🌟", text: "今天給自己一個微笑" }
  },
  {
    id: 15,
    name: "月亮",
    nameEn: "The Moon",
    emoji: "🌕",
    headline: "心裡的話，說出來就輕鬆了。",
    body: "如果有什麼藏在心裡的事，找個信任的人說一說。月亮會聽，朋友也會聽，您不是一個人。",
    task: { emoji: "📞", text: "打電話給一個朋友聊 10 分鐘" }
  },
  {
    id: 16,
    name: "太陽",
    nameEn: "The Sun",
    emoji: "☀️",
    headline: "今天，是屬於您的好天氣！",
    body: "不管外面是晴是雨，心裡有太陽就好。今天適合到陽台或公園走走，讓陽光照在臉上。",
    task: { emoji: "🌞", text: "出門曬太陽 10 分鐘" }
  },
  {
    id: 17,
    name: "審判",
    nameEn: "Judgement",
    emoji: "🔔",
    headline: "原諒自己，是最大的勇氣。",
    body: "過去的事，就讓它過去吧。您已經做得很好了，今天可以放下一個小小的遺憾。",
    task: { emoji: "🤝", text: "對自己說「我做得很好了」" }
  },
  {
    id: 18,
    name: "世界",
    nameEn: "The World",
    emoji: "🌍",
    headline: "您一直都很完整。",
    body: "走過這麼多年，您經歷的、看過的、愛過的，都已經讓您很豐富了。今天，為自己感到驕傲吧！",
    task: { emoji: "👏", text: "對著鏡子說「謝謝您一直這麼努力」" }
  },
  {
    id: 19,
    name: "權杖",
    nameEn: "Wands · Energy",
    emoji: "🔥",
    headline: "今天有一點小小的衝勁！",
    body: "想做的事就試試看吧，不用一次做到完美。動起來，心情就會跟著好起來。",
    task: { emoji: "💪", text: "做 5 分鐘簡單的伸展運動" }
  },
  {
    id: 20,
    name: "聖杯",
    nameEn: "Cups · Heart",
    emoji: "🥰",
    headline: "今天，心會被一個人或一件事溫暖。",
    body: "也許是一通電話、一句問候、一張照片，都會讓您笑出來。請珍惜這份溫暖。",
    task: { emoji: "💕", text: "傳一個問候訊息給一位朋友" }
  },
  {
    id: 21,
    name: "錢幣",
    nameEn: "Pentacles · Life",
    emoji: "🌾",
    headline: "踏實過日子，就是最好的福氣。",
    body: "三餐好好吃、覺好好睡、錢花在開心的小事上。日子穩穩的，就是最幸福的。",
    task: { emoji: "🍚", text: "今天好好吃一頓飯，慢慢嚐味道" }
  }
];
