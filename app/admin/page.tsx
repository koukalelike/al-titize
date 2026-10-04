"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  manga: number;
  chapters: number;
  pages: number;
  users: number;
  premium: number;
  admins: number;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");

  const [stats, setStats] = useState<Stats>({
    manga: 0,
    chapters: 0,
    pages: 0,
    users: 0,
    premium: 0,
    admins: 0,
  });

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email ?? "");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || profile?.role !== "admin") {
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const [
        mangaResult,
        chaptersResult,
        pagesResult,
        usersResult,
      ] = await Promise.all([
        supabase
          .from("manga")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("chapters")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("pages")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("profiles")
          .select("id, role"),
      ]);

      const profiles = usersResult.data ?? [];

      setStats({
        manga: mangaResult.count ?? 0,
        chapters: chaptersResult.count ?? 0,
        pages: pagesResult.count ?? 0,
        users: profiles.length,
        premium: profiles.filter(
          (p) => p.role === "premium"
        ).length,
        admins: profiles.filter(
          (p) => p.role === "admin"
        ).length,
      });

      setLoading(false);
    }

    checkAdmin();
  }, []);

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f7f8fa] text-gray-900"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-5 text-sm font-medium text-gray-500">
            جاري تحميل لوحة التحكم...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6 text-gray-900"
      >
        <div className="w-full max-w-md animate-[fadeIn_.5s_ease-out] rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl">
            🔒
          </div>

          <h1 className="mt-6 text-3xl font-black">
            غير مصرح لك
          </h1>

          <p className="mt-3 text-gray-500">
            يجب تسجيل الدخول بحساب Admin للوصول إلى لوحة التحكم.
          </p>

          <a
            href="/login"
            className="mt-7 inline-flex rounded-xl bg-black px-7 py-3 font-bold text-white transition duration-300 hover:-translate-y-1 hover:bg-gray-800 hover:shadow-lg"
          >
            تسجيل الدخول
          </a>
        </div>
      </main>
    );
  }

  const statCards = [
    {
      label: "Manga",
      title: "المانجا",
      value: stats.manga,
      description: "إجمالي أعمال المانجا",
      href: "/admin/manga",
      icon: "📚",
    },
    {
      label: "Chapters",
      title: "الفصول",
      value: stats.chapters,
      description: "إجمالي الفصول المنشورة",
      href: "/admin/chapters",
      icon: "📖",
    },
    {
      label: "Pages",
      title: "الصفحات",
      value: stats.pages,
      description: "إجمالي صفحات المانجا",
      href: "/admin/pages",
      icon: "🖼️",
    },
    {
      label: "Users",
      title: "المستخدمون",
      value: stats.users,
      description: "إجمالي الحسابات",
      href: "/admin/users",
      icon: "👥",
    },
  ];

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-[#f7f8fa] text-gray-900"
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-96 w-96 animate-pulse rounded-full bg-gray-200/40 blur-3xl" />

        <div className="absolute -bottom-40 -left-40 h-96 w-96 animate-pulse rounded-full bg-gray-200/30 [animation-delay:1s]" />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-lg font-black text-white shadow-lg">
              AT
            </div>

            <div>
              <h1 className="text-lg font-black tracking-[0.2em]">
                AL TITIZE
              </h1>

              <p className="text-[10px] font-bold tracking-[0.3em] text-gray-400">
                ADMIN PANEL
              </p>
            </div>
          </div>

          <a
            href="/"
            className="group flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition duration-300 hover:-translate-y-0.5 hover:border-black hover:text-black hover:shadow-md"
          >
            <span>الموقع</span>

            <span className="transition-transform duration-300 group-hover:-translate-x-1">
              ←
            </span>
          </a>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        {/* HERO */}
        <div className="animate-[fadeUp_.7s_ease-out] rounded-[2rem] border border-gray-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                SYSTEM ONLINE
              </div>

              <p className="text-sm font-bold tracking-[0.25em] text-gray-400">
                ADMIN ACCOUNT
              </p>

              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                لوحة التحكم
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-500 sm:text-base">
                مرحبًا بك مجددًا{" "}
                <span className="font-bold text-gray-900">
                  {email}
                </span>
                . تحكم في محتوى AL TITIZE وإدارة المنصة من مكان واحد.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-5 lg:min-w-[220px]">
              <p className="text-xs font-bold text-gray-400">
                TOTAL CONTENT
              </p>

              <p className="mt-2 text-4xl font-black">
                {stats.manga + stats.chapters + stats.pages}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Manga · Chapters · Pages
              </p>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card, index) => (
            <a
              key={card.label}
              href={card.href}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
              className="group animate-[fadeUp_.7s_ease-out_both] rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition duration-500 hover:-translate-y-2 hover:border-gray-300 hover:shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-xl transition duration-500 group-hover:scale-110 group-hover:rotate-3">
                  {card.icon}
                </div>

                <span className="text-xs font-black tracking-widest text-gray-300">
                  {card.label}
                </span>
              </div>

              <p className="mt-7 text-sm font-bold text-gray-400">
                {card.title}
              </p>

              <p className="mt-1 text-4xl font-black tracking-tight transition duration-300 group-hover:translate-x-1">
                {card.value}
              </p>

              <p className="mt-3 text-xs leading-5 text-gray-500">
                {card.description}
              </p>

              <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="text-xs font-bold text-gray-400 transition group-hover:text-black">
                  إدارة
                </span>

                <span className="transition duration-300 group-hover:-translate-x-2">
                  ←
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* QUICK ACTIONS */}
        <div className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-black tracking-[0.25em] text-gray-400">
              QUICK ACTIONS
            </p>

            <h3 className="mt-2 text-2xl font-black">
              الإجراءات السريعة
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <a
              href="/admin/manga"
              className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-black p-5 text-white shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              <div>
                <p className="text-lg font-black">
                  إضافة مانجا
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  إنشاء عمل جديد
                </p>
              </div>

              <span className="text-2xl transition duration-300 group-hover:scale-125">
                ＋
              </span>
            </a>

            <a
              href="/admin/chapters"
              className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div>
                <p className="text-lg font-black">
                  إضافة فصل
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  إنشاء فصل جديد
                </p>
              </div>

              <span className="text-2xl transition duration-300 group-hover:scale-125">
                ＋
              </span>
            </a>

            <a
              href="/admin/pages"
              className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div>
                <p className="text-lg font-black">
                  رفع صفحات
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  رفع صور فصل
                </p>
              </div>

              <span className="text-2xl transition duration-300 group-hover:scale-125">
                ↑
              </span>
            </a>
          </div>
        </div>

        {/* USERS + MANAGEMENT */}
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-black tracking-widest text-gray-400">
              ACCOUNTS
            </p>

            <h3 className="mt-2 text-xl font-black">
              الحسابات
            </h3>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-gray-50 p-4 text-center">
                <p className="text-2xl font-black">
                  {stats.users}
                </p>

                <p className="mt-1 text-[11px] text-gray-500">
                  الكل
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4 text-center">
                <p className="text-2xl font-black">
                  {stats.premium}
                </p>

                <p className="mt-1 text-[11px] text-gray-500">
                  Premium
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4 text-center">
                <p className="text-2xl font-black">
                  {stats.admins}
                </p>

                <p className="mt-1 text-[11px] text-gray-500">
                  Admin
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm lg:col-span-2">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-black tracking-widest text-gray-400">
                  MANAGEMENT
                </p>

                <h3 className="mt-2 text-xl font-black">
                  مركز الإدارة
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  الوصول السريع إلى جميع أقسام لوحة التحكم.
                </p>
              </div>

              <a
                href="/admin/users"
                className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold transition hover:border-black hover:bg-black hover:text-white"
              >
                إدارة المستخدمين
              </a>
            </div>

            <div className="mt-7 h-px bg-gray-100" />

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <a
                href="/admin/manga"
                className="rounded-xl bg-gray-50 px-4 py-4 text-center text-xs font-bold text-gray-600 transition duration-300 hover:-translate-y-1 hover:bg-black hover:text-white"
              >
                📚
                <span className="mt-2 block">
                  المانجا
                </span>
              </a>

              <a
                href="/admin/chapters"
                className="rounded-xl bg-gray-50 px-4 py-4 text-center text-xs font-bold text-gray-600 transition duration-300 hover:-translate-y-1 hover:bg-black hover:text-white"
              >
                📖
                <span className="mt-2 block">
                  الفصول
                </span>
              </a>

              <a
                href="/admin/pages"
                className="rounded-xl bg-gray-50 px-4 py-4 text-center text-xs font-bold text-gray-600 transition duration-300 hover:-translate-y-1 hover:bg-black hover:text-white"
              >
                🖼️
                <span className="mt-2 block">
                  الصفحات
                </span>
              </a>

              <a
                href="/admin/users"
                className="rounded-xl bg-gray-50 px-4 py-4 text-center text-xs font-bold text-gray-600 transition duration-300 hover:-translate-y-1 hover:bg-black hover:text-white"
              >
                👥
                <span className="mt-2 block">
                  المستخدمون
                </span>
              </a>

              <a
                href="/admin/notifications"
                className="group rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center text-xs font-bold text-gray-600 transition duration-300 hover:-translate-y-1 hover:border-black hover:bg-black hover:text-white"
              >
                🔔
                <span className="mt-2 block">
                  الإشعارات
                </span>
              </a>

              <a
                href="/admin/support"
                className="group rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center text-xs font-bold text-gray-600 transition duration-300 hover:-translate-y-1 hover:border-black hover:bg-black hover:text-white"
              >
                💬
                <span className="mt-2 block">
                  خدمة العملاء
                </span>
              </a>

              {/* VIDEO */}
              <a
                href="/admin/video"
                className="group rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center text-xs font-bold text-gray-600 transition duration-300 hover:-translate-y-1 hover:border-black hover:bg-black hover:text-white"
              >
                🎬
                <span className="mt-2 block">
                  فيديو الموقع
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-12 border-t border-gray-200 pt-6 text-center">
          <p className="text-xs font-medium text-gray-400">
            AL TITIZE ADMIN SYSTEM
          </p>

          <p className="mt-1 text-[10px] text-gray-300">
            Manga publishing platform
          </p>
        </div>
      </section>

      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(25px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.97);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </main>
  );
}