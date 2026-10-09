"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Manga = {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: string;
};

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");

  const [favoriteManga, setFavoriteManga] = useState<Manga[]>([]);
  const [mangaCount, setMangaCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadAccount() {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        setEmail(user.email ?? "");

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
          console.error("PROFILE LOAD ERROR:", profileError);
        }

        setUsername(profile?.username ?? "");

        const { count } = await supabase
          .from("manga")
          .select("id", {
            count: "exact",
            head: true,
          });

        setMangaCount(count ?? 0);

        const { data: favorites } = await supabase
          .from("favorites")
          .select("manga_id")
          .eq("user_id", user.id);

        const favoriteIds =
          favorites?.map((favorite) => favorite.manga_id) ?? [];

        if (favoriteIds.length > 0) {
          const { data: mangaData } = await supabase
            .from("manga")
            .select(
              "id, title, description, cover_url, status"
            )
            .in("id", favoriteIds);

          setFavoriteManga(mangaData ?? []);
        } else {
          setFavoriteManga([]);
        }
      } catch (error) {
        console.error("ACCOUNT LOAD ERROR:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  async function saveUsername() {
    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setUsernameMessage("اكتب اسم مستخدم أولًا.");
      return;
    }

    if (cleanUsername.length < 3) {
      setUsernameMessage(
        "اسم المستخدم يجب أن يكون 3 أحرف على الأقل."
      );
      return;
    }

    if (cleanUsername.length > 30) {
      setUsernameMessage(
        "اسم المستخدم يجب ألا يتجاوز 30 حرفًا."
      );
      return;
    }

    setSavingUsername(true);
    setUsernameMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: existingUser, error: checkError } =
        await supabase
          .from("profiles")
          .select("id")
          .ilike("username", cleanUsername)
          .neq("id", user.id)
          .maybeSingle();

      if (checkError) {
        console.error(
          "USERNAME CHECK ERROR:",
          checkError
        );
      }

      if (existingUser) {
        setUsernameMessage(
          "اسم المستخدم هذا مستخدم بالفعل."
        );
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          username: cleanUsername,
        })
        .eq("id", user.id)
        .select("username")
        .single();

      if (error) {
        console.error(
          "USERNAME UPDATE ERROR:",
          error
        );

        setUsernameMessage(
          `حدث خطأ: ${error.message}`
        );

        return;
      }

      setUsername(data?.username ?? cleanUsername);

      setUsernameMessage(
        "تم حفظ اسم المستخدم بنجاح ✅"
      );
    } catch (error) {
      console.error(
        "SAVE USERNAME ERROR:",
        error
      );

      setUsernameMessage(
        "حدث خطأ أثناء حفظ اسم المستخدم."
      );
    } finally {
      setSavingUsername(false);
    }
  }

  async function logout() {
    setLoggingOut(true);

    try {
      const supabase = createClient();

      await supabase.auth.signOut();

      window.location.href = "/login";
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center overflow-x-hidden bg-white px-4"
      >
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-black" />

          <p className="mt-5 text-sm text-gray-500">
            جاري تحميل الحساب...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-gray-50 text-gray-900"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 md:px-6">
          <Link
            href="/manga"
            className="min-h-11 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold transition active:scale-95 hover:bg-gray-50 sm:px-5 sm:text-sm"
          >
            ← العودة للمكتبة
          </Link>

          <div className="min-w-0 text-center">
            <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 sm:text-xs sm:tracking-[0.25em]">
              AL TITIZE
            </p>

            <h1 className="mt-1 text-base font-black sm:text-lg">
              حسابي
            </h1>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
            👤
          </div>
        </div>
      </header>

      {/* Main */}
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 md:px-6 md:py-14">

        {/* Profile */}
        <div className="rounded-[1.5rem] border border-gray-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black text-2xl text-white sm:h-20 sm:w-20 sm:rounded-3xl sm:text-3xl">
                👤
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 sm:text-xs sm:tracking-[0.25em]">
                  ACCOUNT
                </p>

                <h2 className="mt-1 truncate text-xl font-black sm:mt-2 sm:text-2xl">
                  {username || "مستخدم"}
                </h2>

                <p className="mt-1 max-w-full truncate text-xs text-gray-500 sm:text-sm">
                  {email}
                </p>
              </div>
            </div>

            <div className="w-full rounded-2xl bg-gray-100 px-5 py-3 text-center sm:w-auto">
              <p className="text-xs font-bold text-gray-400">
                الحالة
              </p>

              <p className="mt-1 font-black">
                عضو
              </p>
            </div>
          </div>
        </div>

        {/* Username */}
        <div className="mt-4 rounded-[1.5rem] border border-gray-200 bg-white p-4 shadow-sm sm:mt-6 sm:rounded-[2rem] sm:p-6 md:p-8">
          <div className="mb-5 sm:mb-6">
            <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 sm:text-xs sm:tracking-[0.25em]">
              USERNAME
            </p>

            <h2 className="mt-1 text-xl font-black sm:mt-2 sm:text-2xl">
              اسم المستخدم
            </h2>

            <p className="mt-2 text-xs leading-6 text-gray-500 sm:text-sm">
              غيّر الاسم الذي يظهر عند كتابة التعليقات.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              placeholder="مثال: Adam123"
              maxLength={30}
              className="min-h-12 min-w-0 w-full flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm font-bold outline-none transition focus:border-black focus:bg-white sm:px-5 sm:py-4"
            />

            <button
              onClick={saveUsername}
              disabled={savingUsername}
              className="min-h-12 w-full rounded-2xl bg-black px-7 py-3.5 text-sm font-bold text-white transition active:scale-[0.98] hover:bg-gray-800 disabled:opacity-50 sm:w-auto sm:py-4"
            >
              {savingUsername
                ? "جاري الحفظ..."
                : "حفظ الاسم"}
            </button>
          </div>

          {usernameMessage && (
            <p className="mt-4 rounded-2xl bg-gray-100 p-4 text-center text-xs font-bold leading-6 text-gray-600 sm:text-sm">
              {usernameMessage}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
          <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
            <p className="text-[10px] font-bold tracking-[0.18em] text-gray-400 sm:text-xs sm:tracking-[0.2em]">
              LIBRARY
            </p>

            <p className="mt-2 text-3xl font-black sm:mt-3 sm:text-4xl">
              {mangaCount}
            </p>

            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              إجمالي الأعمال المتاحة
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
            <p className="text-[10px] font-bold tracking-[0.18em] text-gray-400 sm:text-xs sm:tracking-[0.2em]">
              FAVORITES
            </p>

            <p className="mt-2 text-3xl font-black sm:mt-3 sm:text-4xl">
              {favoriteManga.length}
            </p>

            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              الأعمال المحفوظة في المفضلة
            </p>
          </div>
        </div>

        {/* Favorites */}
        <div className="mt-6">
          <div className="mb-4 sm:mb-5">
            <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 sm:text-xs sm:tracking-[0.25em]">
              FAVORITES
            </p>

            <h2 className="mt-1 text-xl font-black sm:mt-2 sm:text-2xl">
              المفضلة ❤️
            </h2>
          </div>

          {favoriteManga.length === 0 ? (
            <div className="rounded-[1.5rem] border border-gray-200 bg-white p-8 text-center shadow-sm sm:rounded-[2rem] sm:p-12">
              <div className="text-5xl">
                🤍
              </div>

              <h3 className="mt-5 text-lg font-black sm:text-xl">
                لا توجد أعمال مفضلة
              </h3>

              <p className="mt-2 text-xs leading-6 text-gray-500 sm:text-sm">
                أضف بعض المانجا إلى المفضلة لتظهر هنا.
              </p>

              <Link
                href="/manga"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-black px-7 py-3 text-sm font-bold text-white transition active:scale-95 hover:bg-gray-800"
              >
                استكشف المكتبة
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {favoriteManga.map((manga) => (
                <Link
                  key={manga.id}
                  href={`/manga/${manga.id}`}
                  className="group overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm transition active:scale-[0.99] hover:-translate-y-1 hover:shadow-lg sm:rounded-[2rem]"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                    {manga.cover_url ? (
                      <img
                        src={manga.cover_url}
                        alt={manga.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-6xl">
                        📖
                      </div>
                    )}
                  </div>

                  <div className="p-4 sm:p-5">
                    <h3 className="truncate text-base font-black sm:text-lg">
                      {manga.title}
                    </h3>

                    <p className="mt-2 text-xs text-gray-500 sm:text-sm">
                      {manga.status}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Email */}
        <div className="mt-4 rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm sm:mt-6 sm:rounded-[2rem] sm:p-6">
          <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 sm:text-xs sm:tracking-[0.25em]">
            EMAIL
          </p>

          <p className="mt-3 break-all text-sm font-bold">
            {email}
          </p>

          <p className="mt-2 text-xs leading-6 text-gray-400">
            البريد الإلكتروني مرتبط بحسابك ولا يمكن تغييره من هنا.
          </p>
        </div>

        {/* Logout */}
        <div className="mt-4 rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm sm:mt-6 sm:rounded-[2rem] sm:p-6">
          <button
            onClick={logout}
            disabled={loggingOut}
            className="min-h-12 w-full rounded-2xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold transition active:scale-[0.98] hover:bg-gray-100 disabled:opacity-50 sm:py-4"
          >
            {loggingOut
              ? "جاري تسجيل الخروج..."
              : "تسجيل الخروج"}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-8 text-center sm:py-10">
        <p className="text-sm font-black tracking-[0.25em]">
          AL TITIZE
        </p>

        <p className="mt-2 text-xs text-gray-400">
          Manga Reader
        </p>
      </footer>
    </main>
  );
}
