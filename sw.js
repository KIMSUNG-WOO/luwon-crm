// LUWON CRM Service Worker — PWA 오프라인 + 푸시 알림
const CACHE_NAME = "luwon-crm-v3";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.svg",
  "./icon-512.svg"
];

// 설치 — 정적 자산 캐시
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

// 활성화 — 이전 캐시 정리
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => clients.claim())
  );
});

// 네트워크 요청 — Network First (Supabase API), Cache First (정적 자산)
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Supabase API — 항상 네트워크 우선
  if (url.hostname.includes("supabase.co") || url.hostname.includes("supabase.in")) {
    return; // 기본 fetch 동작 (네트워크)
  }

  // CDN 스크립트 — 캐시 우선
  if (url.hostname.includes("cdn.jsdelivr.net") || url.hostname.includes("fonts.google")) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 앱 자체 파일 — Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(response => {
            if (response && response.status === 200) {
              cache.put(e.request, response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  }
});

// 푸시 수신 → 알림 표시
self.addEventListener("push", e => {
  let data = { title: "LUWON CRM", body: "새 알림이 있습니다.", icon: "./icon-192.svg", tag: "luwon-push" };
  try {
    if (e.data) {
      const parsed = e.data.json();
      Object.assign(data, parsed);
    }
  } catch(err) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon || "./icon-192.svg",
      badge:   data.badge || "./icon-192.svg",
      tag:     data.tag  || "luwon-push",
      renotify: true,
      vibrate: [200, 100, 200],
      data:    { url: data.url || "/" }
    })
  );
});

// 알림 클릭 → 앱 열기
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes("luwon") && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
