const CACHE = 'agrosense-v2';
const FILES = ['./','./language.html','./login.html','./dashboard.html','./manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Network first for API calls
  if(url.hostname.includes('wttr.in') || url.hostname.includes('ipapi') || url.hostname.includes('nominatim')){
    e.respondWith(
      fetch(e.request).then(res=>{
        const clone = res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return res;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }
  // Cache first for app files
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached) return cached;
      return fetch(e.request).then(res=>{
        if(res&&res.status===200){
          const clone=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,clone));
        }
        return res;
      }).catch(()=>new Response('<h2>Offline</h2>',{headers:{'Content-Type':'text/html'}}));
    })
  );
});
