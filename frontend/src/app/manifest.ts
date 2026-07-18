import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pocketa — مدیریت مالی شخصی",
    short_name: "Pocketa",
    description:
      "SaaS مدیریت مالی شخصی فارسی و RTL: تراکنش، بودجه، ایمپورت پیامک بانکی، گزارش شمسی و تومان.",
    start_url: "/dashboard",
    display: "standalone",
    scope: "/",
    orientation: "portrait-primary",
    background_color: "#eef5ff",
    theme_color: "#2563eb",
    lang: "fa",
    dir: "rtl",
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
