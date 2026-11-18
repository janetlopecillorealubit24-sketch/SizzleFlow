// Caches the app files so it opens offline. Bump VERSION after editing files.
const VERSION='v21', FILES=['./','index.html','style.css','app.js','db.js','manifest.json','icon.svg','images/logo-transparent.png','images/logo.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==VERSION).map(x=>caches.delete(x))))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
