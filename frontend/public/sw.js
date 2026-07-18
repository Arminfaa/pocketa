/* global self, clients */
/* eslint-disable no-undef */

// Bump when changing fetch behavior so iOS installs the new worker.
const SW_VERSION = "pocketa-sw-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

/**
 * Do not intercept /api/* (or other credentialed XHR).
 * On iOS Home Screen PWAs, a SW that re-fetches API requests can drop
 * Set-Cookie / credentialed cookies so login never survives app relaunch.
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }
  // Let the browser handle navigations & static assets without SW meddling.
  // Push notifications still work; no offline cache is required here.
  void SW_VERSION;
});

self.addEventListener("push", (event) => {
  let data = { title: "Pocketa", body: "یادآوری بدهی / قسط", url: "/recurring" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // ignore malformed payload
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Pocketa", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/recurring" },
      dir: "rtl",
      lang: "fa",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/recurring";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});
