import type { Metadata } from "next";
import localFont from "next/font/local";
import Providers from "./providers";
import "./globals.css";

const vazir = localFont({
  src: [
    {
      path: "../../public/vazir/Vazirmatn-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/vazir/Vazirmatn-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/vazir/Vazirmatn-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/vazir/Vazirmatn-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "../../public/vazir/Vazirmatn-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-vazir",
  display: "swap",
  fallback: ["Tahoma", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "Pocketa — مدیریت مالی شخصی",
    template: "%s | Pocketa",
  },
  description:
    "SaaS مدیریت مالی شخصی فارسی و RTL: تراکنش، بودجه، ایمپورت پیامک بانکی، گزارش شمسی و تومان.",
  applicationName: "Pocketa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazir.variable} ${vazir.className}`}
      suppressHydrationWarning
    >
      <body className="bg-app-surface min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
