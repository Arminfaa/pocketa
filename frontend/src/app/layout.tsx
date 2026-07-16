import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const vazir = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-vazir",
});

export const metadata: Metadata = {
  title: "Pocketa - مدیریت مالی شخصی",
  description: "مدیریت درآمدها، هزینه‌ها و بودجه‌بندی با Pocketa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazir.className} suppressHydrationWarning>
      <body className="bg-app min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

