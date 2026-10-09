import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NotificationBell from "@/components/NotificationBell";
import CustomerSupport from "@/components/CustomerSupport";
import SiteVideoBanner from "@/components/SiteVideoBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AL TITIZE — عالمك بين الصفحات",
  description: "اكتشف المانغا، تابع فصولك، وواصل القراءة على AL TITIZE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[200] border-b border-amber-600 bg-amber-300 px-4 py-3 text-center text-sm font-bold text-amber-950 shadow-sm sm:text-base"
        >
          <p dir="rtl">
            🛠️ نعمل حاليًا على تحديث النظام وتطويره. نعتذر عن أي إزعاج، وشكرًا لصبركم.
          </p>
        </div>

        <SiteVideoBanner />

        <div className="fixed bottom-5 left-5 z-[100] flex items-center gap-2">
          <NotificationBell />
          <CustomerSupport />
        </div>

        {children}
      </body>
    </html>
  );
}
