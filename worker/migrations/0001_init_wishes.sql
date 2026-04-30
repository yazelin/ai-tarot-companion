CREATE TABLE IF NOT EXISTS wishes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '匿名',
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_wishes_created ON wishes(created_at DESC);

-- 種子資料：給社區據點剛裝好時看起來不冷清
INSERT OR IGNORE INTO wishes (id, name, text, created_at) VALUES
  ('seed-1', '阿美阿嬤', '希望大家身體都健健康康！', strftime('%s','now')*1000 - 86400000),
  ('seed-2', '老王',   '祝孫子今年考試順利',         strftime('%s','now')*1000 - 7200000),
  ('seed-3', '春枝',   '今天天氣很好，謝謝老天爺',    strftime('%s','now')*1000 - 3600000),
  ('seed-4', '阿福',   '希望我太太膝蓋早點不痛',       strftime('%s','now')*1000 - 1800000);
