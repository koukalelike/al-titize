"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Manga = {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: string;
};

export default function MangaPage() {
  const [manga, setManga] = useState<Manga[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState("ongoing");

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function checkAdmin() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return false;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || profile?.role !== "admin") {
      window.location.href = "/admin";
      return false;
    }

    setAuthorized(true);
    return true;
  }

  async function loadManga() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("manga")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء تحميل المانجا.");
      setLoading(false);
      return;
    }

    setManga(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function initialize() {
      const isAdmin = await checkAdmin();

      if (!isAdmin) {
        return;
      }

      await loadManga();
    }

    initialize();
  }, []);

  async function addManga(e: React.FormEvent) {
    e.preventDefault();

    if (!authorized) {
      return;
    }

    if (!title.trim()) {
      setMessage("اكتب اسم المانجا أولًا.");
      return;
    }

    setSaving(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.from("manga").insert({
      title: title.trim(),
      description: description.trim() || null,
      cover_url: coverUrl.trim() || null,
      status,
    });

    if (error) {
      console.error(error);
      setMessage(`حدث خطأ: ${error.message}`);
      setSaving(false);
      return;
    }

    setTitle("");
    setDescription("");
    setCoverUrl("");
    setStatus("ongoing");

    await loadManga();

    setMessage("تمت إضافة المانجا بنجاح! 🎉");
    setSaving(false);
  }

  async function deleteManga(id: number) {
    if (!authorized) {
      return;
    }

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذه المانجا؟"
    );

    if (!confirmed) {
      return;
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("manga")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage(
        `حدث خطأ أثناء الحذف: ${error.message}`
      );
      return;
    }

    setManga((current) =>
      current.filter((item) => item.id !== id)
    );

    setMessage("تم حذف المانجا بنجاح 🗑️");
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center overflow-x-hidden bg-gray-50 px-4 text-gray-900"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-5 text-sm font-medium text-gray-500">
            جاري التحقق من الصلاحيات...
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
      className="min-h-screen overflow-x-hidden bg-gray-50 text-gray-900"
    >
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-4 sm:px-6 sm:py-5">
          <h1 className="text-base font-bold tracking-widest sm:text-2xl">
            AL TITIZE ADMIN
          </h1>

          <a
            href="/admin"
            className="min-h-11 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-600 transition active:scale-95 hover:border-black hover:text-black sm:text-sm"
          >
            ← لوحة التحكم
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-3 py-7 sm:px-6 sm:py-12">
        <div className="mb-7 sm:mb-10">
          <p className="text-xs font-semibold text-gray-500 sm:text-sm">
            MANGA
          </p>

          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            إدارة المانجا
          </h2>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            إضافة وإدارة المانجا الموجودة في موقع AL TITIZE.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-gray-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
          <h3 className="text-xl font-bold">
            إضافة مانجا جديدة
          </h3>

          <form
            onSubmit={addManga}
            className="mt-6 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                اسم المانجا
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                placeholder="مثال: THE SILENCE"
                className="min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                الوصف
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="اكتب وصف المانجا..."
                rows={4}
                className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                رابط الغلاف
              </label>

              <input
                type="url"
                value={coverUrl}
                onChange={(e) =>
                  setCoverUrl(e.target.value)
                }
                placeholder="https://..."
                className="min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                الحالة
              </label>

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
                className="min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
              >
                <option value="ongoing">
                  مستمرة
                </option>
                <option value="completed">
                  مكتملة
                </option>
                <option value="hiatus">
                  متوقفة
                </option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="min-h-12 w-full rounded-xl bg-black px-6 py-3 font-semibold text-white transition active:scale-[0.98] hover:bg-gray-800 disabled:opacity-50"
            >
              {saving
                ? "جاري الإضافة..."
                : "إضافة المانجا"}
            </button>
          </form>

          {message && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm leading-6 text-gray-700">
              {message}
            </div>
          )}
        </div>

        <div className="mt-8 sm:mt-10">
          <h3 className="mb-5 text-2xl font-bold">
            المانجا الموجودة
          </h3>

          {manga.length === 0 ? (
            <div className="rounded-[1.5rem] border border-gray-200 bg-white p-8 text-center text-gray-500 sm:rounded-2xl">
              لا توجد مانجا حاليًا.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {manga.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm sm:rounded-2xl"
                >
                  {item.cover_url ? (
                    <div className="aspect-[3/4] bg-gray-100">
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center bg-gray-100 text-gray-400">
                      لا يوجد غلاف
                    </div>
                  )}

                  <div className="p-4 sm:p-5">
                    <h4 className="text-xl font-bold">
                      {item.title}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      {item.description ||
                        "لا يوجد وصف."}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {item.status}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          deleteManga(item.id)
                        }
                        className="min-h-10 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}