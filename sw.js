// LUWON CRM Service Worker — 푸시 알림 처리
const CACHE_NAME = "luwon-crm-v1";

// 설치
self.addEventListener("install", e => {
  self.skipWaiting();
});

// 활성화
self.addEventListener("activate", e => {
  e.waitUntil(clients.claim());
});

// 푸시 수신 → 알림 표시
self.addEventListener("push", e => {
  let data = { title: "LUWON CRM", body: "새 알림이 있습니다.", icon: "/favicon.ico", tag: "luwon-push" };
  try {
    if (e.data) {
      const parsed = e.data.json();
      Object.assign(data, parsed);
    }
  } catch(err) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon || "/favicon.ico",
      badge:   data.badge || "/favicon.ico",
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
