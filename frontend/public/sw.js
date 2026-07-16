/* global self, clients */
/* eslint-disable no-undef */

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
      icon: "/logo.png",
      badge: "/logo.png",
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
