/* global self, clients, caches */
/* eslint-disable no-undef */

// Bump when changing fetch / share-target behavior so clients update.
const SW_VERSION = "pocketa-sw-v3-share-target";
const SHARE_CACHE = "pocketa-share-v1";
const SHARE_CACHE_URL = "/__shared_import_text";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

function combineShareParts(title, text, url) {
  const t = String(title || "").trim();
  const body = String(text || "").trim();
  const u = String(url || "").trim();
  if (body) {
    if (t && !body.includes(t) && t.length <= 80) return `${t}\n${body}`.trim();
    return body;
  }
  return [t, u].filter(Boolean).join("\n").trim();
}

function shareLandingHtml(payload) {
  const encoded = JSON.stringify(payload || "");
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pocketa — دریافت اشتراک</title>
  <style>
    body { font-family: Tahoma, sans-serif; background: #0b1220; color: #e5e7eb;
      display: flex; min-height: 100dvh; align-items: center; justify-content: center; margin: 0; }
    p { opacity: .8; font-size: 14px; }
  </style>
</head>
<body>
  <p>در حال انتقال به ایمپورت بانکی…</p>
  <script>
    (function () {
      try {
        var t = ${encoded};
        if (t) sessionStorage.setItem("pocketa.shareImportText", t);
      } catch (e) {}
      location.replace("/imports/bank-sms?from=share");
    })();
  </script>
</body>
</html>`;
}

async function handleShareTarget(request) {
  let payload = "";
  try {
    const formData = await request.formData();
    payload = combineShareParts(
      formData.get("title"),
      formData.get("text"),
      formData.get("url")
    );
  } catch {
    payload = "";
  }

  if (payload) {
    try {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        SHARE_CACHE_URL,
        new Response(payload, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    } catch {
      // ignore — sessionStorage HTML path below is the primary handoff
    }
  }

  // HTML (not 303) so sessionStorage is set before auth redirects.
  return new Response(shareLandingHtml(payload), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Do not intercept /api/* (credentialed XHR).
 * Intercept Web Share Target POST so long SMS bodies are not lost.
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method === "POST" &&
    url.origin === self.location.origin &&
    url.pathname === "/share-target"
  ) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

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
