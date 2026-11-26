// Caches the app files so it opens offline. Bump VERSION after editing files.
const VERSION='v33', FILES=['./','index.html','style.css','app.js','db.js','manifest.json?v=4','icon.svg','images/logo-transparent.png?v=3','images/logo.jpg?v=3','images/app-icon.png?v=3','images/app-icon-192.png?v=4','images/app-icon-512.png?v=4'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(VERSION);
  // Do not prevent PWA installation if a shared host temporarily blocks one
  // asset while it performs a browser check. Successfully fetched files stay
  // available offline and later visits fill the rest of the cache.
  await Promise.all(FILES.map(file => cache.add(file).catch(() => {})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter(key => key !== VERSION).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
