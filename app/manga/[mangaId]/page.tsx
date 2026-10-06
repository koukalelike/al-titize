"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Manga = {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: string;
};

type Chapter = {
  id: number;
  chapter_number: number;
  title: string | null;
  manga_id: number;
  created_at: string;
};

export default function MangaDetailsPage() {
  const params = useParams();
  const mangaId = Number(params.mangaId);

  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadManga() {
      if (!mangaId) {
        setError("معرف المانجا غير صحيح.");
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        const { data: mangaData, error: mangaError } =
          await supabase
            .from("manga")
            .select(
              "id, title, description, cover_url, status"
            )
            .eq("id", mangaId)
            .single();

        if (mangaError) {
          throw new Error(
            `خطأ في تحميل المانجا: ${mangaError.message}`
          );
        }

        const { data: chaptersData, error: chaptersError } =
          await supabase
            .from("chapters")
            .select(
              "id, chapter_number, title, manga_id, created_at"
            )
            .eq("manga_id", mangaId)
            .order("chapter_number", {
              ascending: false,
            });

        if (chaptersError) {
          throw new Error(
            `خطأ في تحميل الفصول: ${chaptersError.message}`
          );
        }

        setManga(mangaData);
        setChapters(chaptersData ?? []);
      } catch (err) {
        console.error("MANGA DETAILS ERROR:", err);

        setError(
          err instanceof Error
            ? err.message
            : "حدث خطأ أثناء تحميل المانجا."
        );
      } finally {
        setLoading(false);
      }
    }

    loadManga();
  }, [mangaId]);

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-white px-5"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-black" />

          <p className="mt-5 text-sm text-gray-500">
            جاري تحميل المانجا...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-white px-5"
      >
        <div className="w-full max-w-xl text-center">
          <div className="text-6xl">⚠️</div>

          <h1 className="mt-6 text-3xl font-black">
            حدث خطأ
          </h1>

          <p className="mt-4 overflow-hidden rounded-2xl bg-gray-100 p-5 text-sm leading-7 text-gray-600">
            {error}
          </p>

          <a
            href="/manga"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-black px-7 py-3 font-bold text-white transition hover:bg-gray-800 active:scale-95"
          >
            العودة إلى المكتبة
          </a>
        </div>
      </main>
    );
  }

  if (!manga) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-white px-5"
      >
        <div className="text-center">
          <div className="text-6xl">📚</div>

          <h1 className="mt-6 text-3xl font-black">
            المانجا غير موجودة
          </h1>

          <a
            href="/manga"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-black px-7 py-3 font-bold text-white active:scale-95"
          >
            العودة إلى المكتبة
          </a>
        </div>
      </main>
    );
  }

  const firstChapter =
    chapters.length > 0
      ? chapters[chapters.length - 1]
      : null;

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-white text-gray-900"
    >
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <a
            href="/manga"
            className="inline-flex min-h-11 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold shadow-sm transition hover:bg-gray-50 active:scale-95 sm:px-5"
          >
            ←
            <span className="mr-1 hidden sm:inline">
              المكتبة
            </span>
          </a>

          <div className="min-w-0 text-center">
            <p className="truncate text-base font-black tracking-[0.15em] sm:text-lg sm:tracking-[0.2em]">
              AL TITIZE
            </p>

            <p className="hidden text-[9px] font-semibold tracking-[0.3em] text-gray-400 sm:block">
              MANGA PLATFORM
            </p>
          </div>

          <a
            href="/account"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-lg shadow-sm transition hover:bg-gray-50 active:scale-95"
            aria-label="الحساب"
          >
            👤
          </a>
        </div>
      </header>

      <section className="border-b border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 md:py-20">
          <div className="grid items-center gap-8 md:grid-cols-[300px_1fr] md:gap-10">
            <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl transition duration-500 hover:-translate-y-1 hover:shadow-2xl sm:max-w-[300px]">
              <div className="aspect-[3/4]">
                {manga.cover_url ? (
                  <img
                    src={manga.cover_url}
                    alt={manga.title}
                    loading="eager"
                    decoding="sync"
                    className="block h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onLoad={(event) => {
                      const image =
                        event.currentTarget;

                      console.log(
                        "[AL TITIZE COVER DEBUG] COVER LOAD SUCCESS"
                      );
                      console.log(
                        "Manga:",
                        manga.title
                      );
                      console.log(
                        "Cover URL:",
                        manga.cover_url
                      );
                      console.log(
                        "Current source:",
                        image.currentSrc
                      );
                    }}
                    onError={(event) => {
                      const image =
                        event.currentTarget;

                      console.error(
                        "[AL TITIZE COVER DEBUG] COVER LOAD FAILED"
                      );
                      console.error(
                        "Manga:",
                        manga.title
                      );
                      console.error(
                        "Cover URL:",
                        manga.cover_url
                      );
                      console.error(
                        "Current source:",
                        image.currentSrc
                      );
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                    لا يوجد غلاف
                  </div>
                )}
              </div>
            </div>

            <div className="text-center md:text-right">
              <div className="inline-flex rounded-full bg-black px-4 py-2 text-xs font-bold text-white shadow-sm">
                {manga.status}
              </div>

              <h1 className="mt-5 break-words text-3xl font-black tracking-tight sm:text-4xl md:mt-6 md:text-6xl">
                {manga.title}
              </h1>

              <p className="mx-auto mt-5 max-w-3xl break-words text-sm leading-7 text-gray-500 sm:text-base sm:leading-8 md:mx-0 md:mt-6">
                {manga.description ||
                  "لا يوجد وصف لهذه المانجا حتى الآن."}
              </p>

              <div className="mt-7 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:justify-center md:justify-start">
                <a
                  href={
                    firstChapter
                      ? `/manga/${manga.id}/chapter/${firstChapter.id}`
                      : "#chapters"
                  }
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-black px-7 py-3 font-bold text-white shadow-lg transition hover:bg-gray-800 active:scale-95"
                >
                  📖 ابدأ القراءة
                </a>

                <a
                  href="#chapters"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white px-7 py-3 font-bold shadow-sm transition hover:bg-gray-50 active:scale-95"
                >
                  📚 الفصول
                </a>
              </div>

              <div className="mx-auto mt-8 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-3 md:mx-0 md:mt-10">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <p className="text-xs font-bold text-gray-400">
                    الفصول
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {chapters.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <p className="text-xs font-bold text-gray-400">
                    الحالة
                  </p>

                  <p className="mt-2 truncate text-sm font-black">
                    {manga.status}
                  </p>
                </div>

                <div className="col-span-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:col-span-1">
                  <p className="text-xs font-bold text-gray-400">
                    المنصة
                  </p>

                  <p className="mt-2 text-sm font-black">
                    AL TITIZE
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="chapters"
        className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16"
      >
        <div className="mb-7">
          <p className="text-xs font-bold tracking-[0.3em] text-gray-400">
            CHAPTERS
          </p>

          <h2 className="mt-2 text-3xl font-black sm:text-4xl">
            الفصول
          </h2>

          <p className="mt-3 text-sm text-gray-500 sm:text-base">
            اختر الفصل الذي تريد قراءته.
          </p>
        </div>

        {chapters.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-10 text-center sm:p-16">
            <div className="text-6xl">📖</div>

            <h3 className="mt-6 text-2xl font-black">
              لا توجد فصول بعد
            </h3>

            <p className="mt-3 text-sm text-gray-500 sm:text-base">
              سيتم إضافة الفصول قريبًا.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((chapter) => (
              <a
                key={chapter.id}
                href={`/manga/${manga.id}/chapter/${chapter.id}`}
                className="group flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg active:scale-[0.99] sm:p-5"
              >
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-sm font-black text-white sm:h-12 sm:w-12">
                    {chapter.chapter_number}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 sm:text-xs">
                      CHAPTER {chapter.chapter_number}
                    </p>

                    <h3 className="mt-1 truncate text-base font-black sm:text-lg">
                      {chapter.title ||
                        `الفصل ${chapter.chapter_number}`}
                    </h3>
                  </div>
                </div>

                <div className="flex h-11 shrink-0 items-center rounded-xl bg-gray-100 px-3 text-xs font-bold transition group-hover:bg-black group-hover:text-white sm:px-4 sm:text-sm">
                  <span className="hidden sm:inline">
                    قراءة
                  </span>

                  <span className="sm:hidden">
                    →
                  </span>

                  <span className="hidden sm:inline">
                    {" "}
                    →
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center sm:px-6 sm:py-10">
          <p className="text-sm font-black tracking-[0.25em]">
            AL TITIZE
          </p>

          <p className="mt-2 text-xs text-gray-400">
            Manga Platform
          </p>
        </div>
      </footer>
    </main>
  );
}