import type { MetadataRoute } from "next";

/** Web Share Target is valid W3C manifest; Next's Manifest type lags behind. */
type ManifestWithShareTarget = MetadataRoute.Manifest & {
  share_target?: {
    action: string;
    method?: "GET" | "POST";
    enctype?: "application/x-www-form-urlencoded" | "multipart/form-data";
    params?: {
      title?: string;
      text?: string;
      url?: string;
    };
  };
};

export default function manifest(): ManifestWithShareTarget {
  return {
    name: "Pocketa — مدیریت مالی شخصی",
    short_name: "Pocketa",
    description:
      "SaaS مدیریت مالی شخصی فارسی و RTL: تراکنش، بودجه، ایمپورت پیامک بانکی، گزارش شمسی و تومان.",
    start_url: "/dashboard",
    display: "standalone",
    scope: "/",
    orientation: "portrait-primary",
    background_color: "#0b1220",
    theme_color: "#06b6d4",
    lang: "fa",
    dir: "rtl",
    /**
     * Web Share Target — Share text/SMS into bank import.
     * Best on Android Chrome installed PWA; iOS PWAs do not expose this yet.
     */
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    shortcuts: [
      {
        name: "ایمپورت پیامک بانکی",
        short_name: "ایمپورت",
        description: "چسباندن یا اشتراک پیامک/رسید بانکی",
        url: "/imports/bank-sms",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
