const CACHE_NAME='nath-review-v2';
const ASSETS=[
  '/kinder-review/',
  '/kinder-review/index.html',
  '/kinder-review/manifest.json',
  '/kinder-review/icon-192.png',
  '/kinder-review/icon-512.png',
  '/kinder-review/apple-touch-icon.png'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  // Network-first for HTML, cache-first for assets
  if(e.request.url.endsWith('.html')||e.request.url.endsWith('/')){
    e.respondWith(
      fetch(e.request).then(r=>{
        const clone=r.clone();
        caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));
        return r;
      }).catch(()=>caches.match(e.request))
    );
  }else{
    e.respondWith(
      caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
        const clone=res.clone();
        caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));
        return res;
      }))
    );
  }
});
