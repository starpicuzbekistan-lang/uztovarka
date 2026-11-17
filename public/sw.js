/* UZTOVARKA: PWA installability; shaxsiy ma'lumotlar offline keshga yozilmaydi. */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="uz"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UZTOVARKA</title><body style="font-family:sans-serif;padding:2rem"><h2>Internet aloqasi yo‘q</h2><p>Ilovadan foydalanish uchun internetni yoqing va qayta urinib ko‘ring.</p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  )));
});
