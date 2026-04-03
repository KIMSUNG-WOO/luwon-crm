// LUWON CRM Service Worker — Network First (캐시 완전 우회)
const CACHE_NAME = "luwon-crm-v24";

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

// fetch — 같은 도메인 요청만 Network First (외부 도메인은 브라우저 직접 처리)
self.addEventListener("fetch", function(e) {
  const url = e.request.url;

  // Supabase API 요청은 절대 가로채지 않음 → 브라우저가 직접 처리
  if (url.includes("supabase.co")) return;

  // POST 등 non-GET은 SW 개입하지 않음
  if (e.request.method !== "GET") return;

  // 외부 도메인(CDN 등)도 SW가 개입하지 않음
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== location.origin) return;
  } catch(err) { return; }

  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .catch(() => caches.match(e.request)
        .then(r => r || new Response("", { status: 503, statusText: "Offline" }))
      )
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
