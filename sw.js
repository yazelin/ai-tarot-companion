// Service Worker — 網路優先策略（network-first）
// 目的：每次有網路就拿最新檔，瀏覽器再也不需要靠 ?v= 破快取
// 副作用：完全離線時自動退回上次快取的版本

const CACHE = 'tarot-companion-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;       // 同網域才管
  if (e.request.url.includes('/api/') ) return;                      // API 不快取
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
