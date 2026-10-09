"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Manga = {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: string;
};

export default function MangaPage() {
  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function loadManga() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);

        const { data: favorites } = await supabase
          .from("favorites")
          .select("manga_id")
          .eq("user_id", user.id);

        setFavoriteIds(
          favorites?.map((favorite) => favorite.manga_id) ?? []
        );
      }

      const { data, error } = await supabase
        .from("manga")
        .select("id, title, description, cover_url, status")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("MANGA ERROR:", error);
        setMangaList([]);
      } else {
        setMangaList(data ?? []);
      }

      setLoading(false);
    }

    loadManga();
  }, []);

  async function toggleFavorite(mangaId: number) {
    if (!userId) {
      alert("يجب تسجيل الدخول لإضافة المانجا إلى المفضلة.");
      return;
    }

    const supabase = createClient();
    const isFavorite = favoriteIds.includes(mangaId);

    if (isFavorite) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("manga_id", mangaId);

      if (error) {
        console.error("REMOVE FAVORITE ERROR:", error);
        return;
      }

      setFavoriteIds((current) =>
        current.filter((id) => id !== mangaId)
      );
    } else {
      const { error } = await supabase
        .from("favorites")
        .insert({
          user_id: userId,
          manga_id: mangaId,
        });

      if (error) {
        console.error("ADD FAVORITE ERROR:", error);
        return;
      }

      setFavoriteIds((current) => [...current, mangaId]);
    }
  }

  const featuredManga = mangaList.slice(0, 3);

  const favoriteManga = mangaList.filter((manga) =>
    favoriteIds.includes(manga.id)
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredManga = useMemo(() => {
    return mangaList.filter((manga) => {
      const title = manga.title.toLowerCase().trim();

      const description = (manga.description ?? "")
        .toLowerCase()
        .trim();

      const status = manga.status.toLowerCase().trim();

      const matchesSearch =
        normalizedSearch === "" ||
        title.includes(normalizedSearch) ||
        description.includes(normalizedSearch);

      const matchesFilter =
        filter === "all" ||
        (filter === "ongoing" &&
          (status === "ongoing" || status === "مستمرة")) ||
        (filter === "completed" &&
          (status === "completed" || status === "مكتملة"));

      return matchesSearch && matchesFilter;
    });
  }, [mangaList, normalizedSearch, filter]);

  function resetFilters() {
    setSearch("");
    setFilter("all");
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-white px-5"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-black" />

          <p className="mt-5 text-sm text-gray-500">
            جاري تحميل مكتبة المانجا...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-white text-gray-900"
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-[0.16em] sm:text-2xl sm:tracking-[0.25em]">
              AL TITIZE
            </h1>

            <p className="mt-1 text-[8px] font-semibold tracking-[0.2em] text-gray-400 sm:text-[10px] sm:tracking-[0.3em]">
              MANGA LIBRARY
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="hidden min-h-11 items-center justify-center rounded-full border border-gray-200 bg-white px-5 text-sm font-bold shadow-sm transition hover:bg-gray-50 active:scale-95 sm:inline-flex"
            >
              الرئيسية
            </Link>

            {userId && (
              <a
                href="/account"
                className="flex min-h-11 items-center gap-2 rounded-full border border-gray-200 bg-white px-2 shadow-sm transition hover:bg-gray-50 active:scale-95 sm:px-4"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm text-white">
                  👤
                </span>

                <span className="hidden text-sm font-bold sm:block">
                  حسابي
                </span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-100 bg-gray-50">
        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-gray-200 blur-3xl sm:h-80 sm:w-80" />

        <div className="pointer-events-none absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-gray-200 blur-3xl sm:h-80 sm:w-80" />

        <div className="relative mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 sm:py-20">
          <div className="mx-auto mb-5 inline-flex rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold shadow-sm sm:px-5 sm:text-sm">
            📚 AL TITIZE MANGA
          </div>

          <h2 className="text-4xl font-black tracking-tight sm:text-5xl md:text-7xl">
            مكتبة المانجا
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-gray-500 sm:mt-6 sm:text-lg sm:leading-8">
            اكتشف أعمال المانجا، احفظ المفضلة لديك
            واستكشف أحدث الإصدارات.
          </p>
        </div>
      </section>

      {/* Featured */}
      {featuredManga.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mb-6">
            <p className="text-xs font-bold tracking-[0.3em] text-gray-400">
              FEATURED
            </p>

            <h3 className="mt-2 text-2xl font-black sm:text-3xl">
              ⭐ مانجا مميزة
            </h3>

            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              أعمال مختارة من مكتبة AL TITIZE.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
            {featuredManga.map((manga, index) => (
              <article
                key={manga.id}
                className={`group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition duration-500 hover:-translate-y-2 hover:shadow-2xl ${
                  index === 0 ? "md:scale-[1.02]" : ""
                }`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 sm:aspect-[16/9]">
                  {manga.cover_url ? (
                    <img
                      src={manga.cover_url}
                      alt={manga.title}
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="block h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                      لا يوجد غلاف
                    </div>
                  )}

                  <div className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold shadow-sm sm:right-4 sm:top-4">
                    ⭐ مميزة
                  </div>

                  <button
                    onClick={() => toggleFavorite(manga.id)}
                    className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl shadow-md transition hover:scale-110 active:scale-90 sm:left-4 sm:top-4"
                    title="إضافة إلى المفضلة"
                    aria-label="إضافة إلى المفضلة"
                  >
                    {favoriteIds.includes(manga.id)
                      ? "❤️"
                      : "🤍"}
                  </button>
                </div>

                <div className="p-5">
                  <h4 className="break-words text-xl font-black">
                    {manga.title}
                  </h4>

                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
                    {manga.description ||
                      "لا يوجد وصف لهذه المانجا."}
                  </p>

                  <a
                    href={`/manga/${manga.id}`}
                    className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-black px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]"
                  >
                    اقرأ الآن →
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Favorites */}
      {favoriteManga.length > 0 && (
        <section
          id="favorites"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-10 sm:px-6 sm:pb-14"
        >
          <div className="mb-6">
            <p className="text-xs font-bold tracking-[0.3em] text-gray-400">
              MY FAVORITES
            </p>

            <h3 className="mt-2 text-2xl font-black sm:text-3xl">
              ❤️ مفضلاتي
            </h3>

            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              المانجا التي اخترتها للعودة إليها لاحقًا.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteManga.map((manga) => (
              <article
                key={manga.id}
                className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition duration-500 hover:-translate-y-2 hover:shadow-xl"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                  {manga.cover_url ? (
                    <img
                      src={manga.cover_url}
                      alt={manga.title}
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="block h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                      لا يوجد غلاف
                    </div>
                  )}

                  <button
                    onClick={() => toggleFavorite(manga.id)}
                    className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl shadow-md transition hover:scale-110 active:scale-90 sm:left-4 sm:top-4"
                    title="إزالة من المفضلة"
                    aria-label="إزالة من المفضلة"
                  >
                    ❤️
                  </button>
                </div>

                <div className="p-5">
                  <h4 className="break-words text-xl font-black">
                    {manga.title}
                  </h4>

                  <p className="mt-2 text-sm text-gray-500">
                    {manga.status}
                  </p>

                  <a
                    href={`/manga/${manga.id}`}
                    className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-black px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]"
                  >
                    اقرأ الآن →
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Library */}
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 sm:pb-20">
        <div className="mb-7 text-center">
          <p className="text-xs font-bold tracking-[0.3em] text-gray-400">
            ALL MANGA
          </p>

          <h3 className="mt-3 text-3xl font-black sm:text-4xl">
            جميع المانجا
          </h3>

          <p className="mt-3 text-sm text-gray-500 sm:text-base">
            ابحث واستخدم الفلاتر للوصول بسرعة إلى ما تريد.
          </p>
        </div>

        {/* Search */}
        <div className="mx-auto mb-7 max-w-5xl rounded-3xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">
                🔎
              </span>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن اسم المانجا أو وصفها..."
                className="min-h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-12 text-sm outline-none transition focus:border-black focus:bg-white"
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600 transition hover:bg-black hover:text-white active:scale-90"
                  aria-label="مسح البحث"
                  title="مسح البحث"
                >
                  ×
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:w-auto lg:overflow-visible lg:pb-0">
              <button
                onClick={() => setFilter("all")}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-2xl px-5 text-sm font-bold transition active:scale-95 ${
                  filter === "all"
                    ? "bg-black text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                الكل
              </button>

              <button
                onClick={() => setFilter("ongoing")}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-2xl px-5 text-sm font-bold transition active:scale-95 ${
                  filter === "ongoing"
                    ? "bg-black text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                مستمرة
              </button>

              <button
                onClick={() => setFilter("completed")}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-2xl px-5 text-sm font-bold transition active:scale-95 ${
                  filter === "completed"
                    ? "bg-black text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                مكتملة
              </button>
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {filteredManga.length === 0
                ? "لا توجد نتائج"
                : `${filteredManga.length} نتيجة`}
            </p>

            {(search || filter !== "all") && (
              <p className="mt-1 text-xs text-gray-400">
                النتائج الحالية حسب بحثك والفلاتر المحددة.
              </p>
            )}
          </div>

          {(search || filter !== "all") && (
            <button
              onClick={resetFilters}
              className="min-h-11 self-start rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 transition hover:bg-black hover:text-white active:scale-95 sm:self-auto"
            >
              إعادة ضبط البحث ×
            </button>
          )}
        </div>

        {/* Results */}
        {filteredManga.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white px-5 py-14 text-center shadow-sm sm:px-6 sm:py-16">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-4xl">
              🔎
            </div>

            <h4 className="mt-6 text-2xl font-black">
              لم نجد أي مانجا
            </h4>

            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-500">
              لم نتمكن من العثور على نتائج مطابقة.
              جرّب اسمًا آخر أو أعد ضبط الفلاتر.
            </p>

            {(search || filter !== "all") && (
              <button
                onClick={resetFilters}
                className="mt-6 min-h-12 rounded-2xl bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-gray-800 active:scale-95"
              >
                عرض كل المانجا
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredManga.map((manga) => (
              <article
                key={manga.id}
                className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition duration-500 hover:-translate-y-2 hover:shadow-2xl"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                  {manga.cover_url ? (
                    <img
                      src={manga.cover_url}
                      alt={manga.title}
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="block h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                      لا يوجد غلاف
                    </div>
                  )}

                  <button
                    onClick={() => toggleFavorite(manga.id)}
                    className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl shadow-md transition hover:scale-110 active:scale-90 sm:left-4 sm:top-4"
                    title={
                      favoriteIds.includes(manga.id)
                        ? "إزالة من المفضلة"
                        : "إضافة إلى المفضلة"
                    }
                    aria-label={
                      favoriteIds.includes(manga.id)
                        ? "إزالة من المفضلة"
                        : "إضافة إلى المفضلة"
                    }
                  >
                    {favoriteIds.includes(manga.id)
                      ? "❤️"
                      : "🤍"}
                  </button>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="min-w-0 break-words text-xl font-black">
                      {manga.title}
                    </h4>

                    <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600">
                      {manga.status}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-500">
                    {manga.description ||
                      "لا يوجد وصف لهذه المانجا."}
                  </p>

                  <a
                    href={`/manga/${manga.id}`}
                    className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-black px-5 py-3 text-center font-bold text-white transition duration-300 hover:bg-gray-800 active:scale-[0.98]"
                  >
                    ابدأ القراءة →
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center sm:px-6">
          <p className="text-sm font-bold tracking-[0.25em]">
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
