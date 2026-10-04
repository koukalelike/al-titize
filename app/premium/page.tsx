"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Manga = {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: string;
};

export default function PremiumPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");
  const [entered, setEntered] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [mangaList, setMangaList] = useState<Manga[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function loadPremium() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      setEmail(user.email ?? "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        router.replace("/");
        return;
      }

      if (profile.role === "admin") {
        router.replace("/admin");
        return;
      }

      if (profile.role !== "premium") {
        router.replace("/manga");
        return;
      }

      const { data: mangaData } = await supabase
        .from("manga")
        .select("id, title, description, cover_url, status")
        .order("created_at", { ascending: false });

      setMangaList(mangaData ?? []);

      setAuthorized(true);
      setLoading(false);

      setTimeout(() => {
        setEntered(true);
      }, 100);
    }

    loadPremium();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/");
  }

  const filteredManga = useMemo(() => {
    return mangaList.filter((manga) => {
      const matchesSearch = manga.title
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        filter === "all" ||
        (filter === "ongoing" &&
          manga.status.toLowerCase() === "ongoing") ||
        (filter === "completed" &&
          manga.status.toLowerCase() === "completed");

      return matchesSearch && matchesFilter;
    });
  }, [mangaList, search, filter]);

  const featuredManga = mangaList.slice(0, 3);

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-white"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-black" />

          <p className="mt-5 text-sm text-gray-500">
            جاري تجهيز تجربة Premium...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-white text-gray-900"
    >
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute -right-40 -top-40 h-96 w-96 rounded-full bg-gray-100 blur-3xl transition-all duration-[1500ms] ${
            entered
              ? "scale-100 opacity-100"
              : "scale-50 opacity-0"
          }`}
        />

        <div
          className={`absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gray-100 blur-3xl transition-all duration-[1500ms] ${
            entered
              ? "scale-100 opacity-100"
              : "scale-50 opacity-0"
          }`}
        />
      </div>

      {/* Header */}
      <header
        className={`relative z-30 border-b border-gray-100 bg-white/80 backdrop-blur-xl transition-all duration-1000 ${
          entered
            ? "translate-y-0 opacity-100"
            : "-translate-y-8 opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-black tracking-[0.25em]">
              AL TITIZE
            </h1>

            <p className="mt-1 text-[10px] font-semibold tracking-[0.3em] text-gray-400">
              PREMIUM EXPERIENCE
            </p>
          </div>

          <div className="relative flex items-center gap-4">
            <div className="hidden rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold shadow-sm sm:block">
              ⭐ Premium
            </div>

            <button
              onClick={() => setAccountOpen((value) => !value)}
              className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm transition hover:border-gray-300 hover:shadow-md"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                {email.charAt(0).toUpperCase()}
              </div>

              <div className="hidden text-right sm:block">
                <p className="text-xs text-gray-400">
                  الحساب
                </p>

                <p className="max-w-[180px] truncate text-sm font-semibold">
                  {email}
                </p>
              </div>

              <span
                className={`text-xs transition-transform duration-300 ${
                  accountOpen ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {accountOpen && (
              <div className="absolute left-0 top-16 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="border-b border-gray-100 p-5">
                  <p className="text-xs text-gray-400">
                    الحساب الحالي
                  </p>

                  <p className="mt-2 truncate text-sm font-bold">
                    {email}
                  </p>

                  <div className="mt-3 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">
                    ⭐ Premium
                  </div>
                </div>

                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-right text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>
                      {loggingOut
                        ? "جاري تسجيل الخروج..."
                        : "تسجيل الخروج"}
                    </span>

                    <span>↪</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-12 pt-24">
        <div
          className={`mx-auto max-w-4xl text-center transition-all duration-[1200ms] ${
            entered
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-10 scale-95 opacity-0"
          }`}
        >
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold shadow-sm">
            <span className="animate-pulse">⭐</span>
            <span>تجربة AL TITIZE Premium</span>
          </div>

          <h2 className="text-5xl font-black leading-tight tracking-tight md:text-7xl">
            مرحبًا بك في
            <br />

            <span className="bg-gradient-to-l from-black via-gray-500 to-black bg-clip-text text-transparent">
              عالم AL TITIZE
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-gray-500">
            تجربة Premium خاصة لعشاق المانجا.
            استكشف أعمالك وابدأ القراءة.
          </p>
        </div>
      </section>

      {/* Featured Manga */}
      {featuredManga.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-6 py-10">
          <div className="mb-8">
            <p className="text-xs font-bold tracking-[0.3em] text-gray-400">
              FEATURED
            </p>

            <h3 className="mt-2 text-3xl font-black">
              ⭐ مانغا مميزة
            </h3>

            <p className="mt-2 text-gray-500">
              اكتشف أحدث الأعمال في مكتبة AL TITIZE.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {featuredManga.map((manga, index) => (
              <article
                key={manga.id}
                className={`group relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition duration-500 hover:-translate-y-2 hover:shadow-2xl ${
                  index === 0 ? "md:scale-[1.02]" : ""
                }`}
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
                  {manga.cover_url ? (
                    <img
                      src={manga.cover_url}
                      alt={manga.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      لا يوجد غلاف
                    </div>
                  )}

                  <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold shadow-sm">
                    ⭐ مميزة
                  </div>
                </div>

                <div className="p-5">
                  <h4 className="text-xl font-black">
                    {manga.title}
                  </h4>

                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
                    {manga.description ||
                      "لا يوجد وصف لهذه المانجا."}
                  </p>

                  <a
                    href={`/manga/${manga.id}`}
                    className="mt-4 block rounded-xl bg-black px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-gray-800"
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
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-14">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold tracking-[0.3em] text-gray-400">
            PREMIUM LIBRARY
          </p>

          <h3 className="mt-3 text-4xl font-black">
            مكتبة المانجا
          </h3>

          <p className="mt-3 text-gray-500">
            ابحث عن المانجا واختر حالتها.
          </p>
        </div>

        {/* Search + Filter */}
        <div className="mx-auto mb-10 flex max-w-4xl flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              🔎
            </span>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن مانجا..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-4 pl-4 pr-12 text-sm outline-none transition focus:border-black focus:bg-white"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${
                filter === "all"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              الكل
            </button>

            <button
              onClick={() => setFilter("ongoing")}
              className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${
                filter === "ongoing"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              مستمرة
            </button>

            <button
              onClick={() => setFilter("completed")}
              className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${
                filter === "completed"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              مكتملة
            </button>
          </div>
        </div>

        {/* Result count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            عدد النتائج:{" "}
            <span className="font-bold text-black">
              {filteredManga.length}
            </span>
          </p>

          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-sm font-semibold text-gray-500 hover:text-black"
            >
              مسح البحث ×
            </button>
          )}
        </div>

        {/* Manga Grid */}
        {filteredManga.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-16 text-center shadow-sm">
            <div className="text-5xl">🔎</div>

            <h4 className="mt-5 text-xl font-black">
              لم نجد أي مانجا
            </h4>

            <p className="mt-2 text-gray-500">
              جرّب تغيير كلمة البحث أو الفلتر.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredManga.map((manga) => (
              <article
                key={manga.id}
                className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition duration-500 hover:-translate-y-3 hover:shadow-2xl"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                  {manga.cover_url ? (
                    <img
                      src={manga.cover_url}
                      alt={manga.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      لا يوجد غلاف
                    </div>
                  )}

                  <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold shadow-sm">
                    ⭐ Premium
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xl font-black">
                      {manga.title}
                    </h4>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      {manga.status}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-500">
                    {manga.description ||
                      "لا يوجد وصف لهذه المانجا."}
                  </p>

                  <a
                    href={`/manga/${manga.id}`}
                    className="mt-6 block rounded-xl bg-black px-5 py-3 text-center font-bold text-white transition duration-300 hover:bg-gray-800"
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
        <div className="mx-auto max-w-7xl px-6 py-8 text-center">
          <p className="text-sm font-bold tracking-[0.25em]">
            AL TITIZE
          </p>

          <p className="mt-2 text-xs text-gray-400">
            Premium Manga Experience
          </p>
        </div>
      </footer>
    </main>
  );
}