import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AL TITIZE — صيانة مؤقتة",
  description: "نعمل على تحديث وتطوير AL TITIZE. نعتذر عن الإزعاج.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  void children;

  return (
    <html lang="ar">
      <body>
        <main
          dir="rtl"
          role="status"
          aria-live="polite"
          className="grid min-h-screen place-items-center px-5 py-12 text-center"
        >
          <section className="max-w-xl space-y-5">
            <div aria-hidden="true" className="text-5xl">
              🛠️
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">
              نعمل على تحديث النظام
            </h1>
            <p className="text-lg text-gray-300">
              الموقع متوقف مؤقتًا لإجراء تحديثات وتطويرات.
            </p>
            <p className="text-gray-400">
              نعتذر عن الإزعاج، وشكرًا لصبركم.
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}
