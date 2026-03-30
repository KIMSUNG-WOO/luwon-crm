// LUWON CRM Service Worker — Network First (캐시 완전 우회)
const CACHE_NAME = "luwon-crm-v20";

// 설치 — skipWaiting으로 즉시 활성화
self.addEventListener("install", e => {
  self.skipWaiting();
});

// 활성화 — 이전 캐시 전부 삭제 + 즉시 클라이언트 제어
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

// fetch — Supabase/CDN 포함 모든 요청 Network First
self.addEventListener("fetch", e => {
  // POST 등 non-GET은 SW 개입하지 않음
  if (e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .catch(() => caches.match(e.request)) // 오프라인 폴백만 허용
  );
});

// 푸시 수신 → 알림 표시
self.addEventListener("push", e => {
  let data = { title: "LUWON CRM", body: "새 알림이 있습니다.", icon: "./icon-192.svg", tag: "luwon-push" };
  try { if (e.data) Object.assign(data, e.data.json()); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: data.icon || "./icon-192.svg",
      badge: data.badge || "./icon-192.svg", tag: data.tag || "luwon-push",
      renotify: true, vibrate: [200, 100, 200],
      data: { url: data.url || "/" }
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
