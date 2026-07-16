"use client";

import { useEffect } from "react";

/** Registers the service worker so the app is installable as a PWA. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Pull the latest SW so iOS picks up fetch/cookie fixes without waiting.
          void registration.update();
        })
        .catch(() => {
          // ignore registration failures (e.g. private mode / unsupported)
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
