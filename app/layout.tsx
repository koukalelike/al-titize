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
  title: "AL TITIZE",
  description: "AL TITIZE Manga Website",
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
        <SiteVideoBanner />

        <div className="fixed right-5 top-5 z-[100] flex items-center gap-2">
          <NotificationBell />
          <CustomerSupport />
        </div>

        {children}
      </body>
    </html>
  );
}