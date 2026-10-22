/* SachiSeva service worker: works offline and shows phone notifications.
 * The build fills in PRECACHE with every file the app needs. */
const VERSION = '__VERSION__';
const SHELL = `sachiseva-shell-${VERSION}`;
const DATA = 'sachiseva-data';
const PRECACHE = __PRECACHE__;

// Data the app can show from the last visit when there is no internet.
const CACHED_TABLES = /\/rest\/v1\/(schemes|sachivalayam_centers|meeseva_centers|applications|application_status_history|application_messages|application_drafts|profiles|user_documents|grievances|agent_reports)\b/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sachiseva-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // Signed out: forget this person's saved data.
  if (event.data === 'clear-data') event.waitUntil(caches.delete(DATA));
});

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // sending forms, uploads and messages always go to the internet
  const url = new URL(req.url);

  // Pages: try the internet, else the saved app.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('/index.html', { cacheName: SHELL })) || (await caches.match('/', { cacheName: SHELL }))),
    );
    return;
  }

  // App files: saved copy first (file names change on every release).
  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || PRECACHE.includes(url.pathname))) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
      return res;
    })));
    return;
  }

  // Scheme list, centres and your own applications: latest from the internet, last saved copy offline.
  if (url.hostname.endsWith('.supabase.co') && CACHED_TABLES.test(url.pathname)) {
    event.respondWith(networkFirst(req, DATA, 8000));
  }
});

/* ── Notifications ─────────────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { title: 'SachiSeva', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'SachiSeva', {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || undefined,
      renotify: Boolean(d.tag),
      data: { url: d.url || '/my-applications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          w.focus();
          return w.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
