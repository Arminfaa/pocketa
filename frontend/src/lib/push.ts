"use client";

import api from "@/services/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function getLocalPushEndpoint(): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  if (Notification.permission !== "granted") return null;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}

export async function fetchPushStatus(): Promise<{
  configured: boolean;
  /** True only if THIS browser/device is subscribed and registered on the server */
  subscribed: boolean;
  thisDevice: boolean;
  subscriptionCount: number;
  supported: boolean;
}> {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  const endpoint = supported ? await getLocalPushEndpoint() : null;

  const res = await api.get("/api/push/status", {
    params: endpoint ? { endpoint } : undefined,
  });
  const data = res.data.data as {
    configured: boolean;
    subscribed: boolean;
    thisDevice?: boolean;
    subscriptionCount: number;
  };

  const thisDevice = Boolean(endpoint && data.subscribed);
  return {
    configured: Boolean(data.configured),
    subscribed: thisDevice,
    thisDevice,
    subscriptionCount: Number(data.subscriptionCount ?? 0),
    supported,
  };
}

export async function enablePushNotifications(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("این مرورگر از پوش نوتیفیکیشن پشتیبانی نمی‌کند");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("اجازه نوتیفیکیشن داده نشد");
  }

  const keyRes = await api.get("/api/push/vapid-public-key");
  const publicKey = keyRes.data?.data?.publicKey as string | undefined;
  if (!publicKey) throw new Error("کلید پوش در سرور تنظیم نشده");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("اشتراک پوش نامعتبر است");
  }

  await api.post("/api/push/subscribe", {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  });
}

export async function disablePushNotifications(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api.post("/api/push/unsubscribe", { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
}
