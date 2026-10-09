"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Manga = {
  id: number;
  title: string;
};

type Chapter = {
  id: number;
  manga_id: number;
  chapter_number: number;
  title: string | null;
  mangadex_chapter_id: string | null;
  scanlation_groups: {
    id: string;
    name: string;
  }[] | null;
};

function getMangaPageStoragePath(imageUrl: string): string | null {
  const publicBucketPath =
    "/storage/v1/object/public/manga-pages/";

  try {
    const pathname = new URL(imageUrl).pathname;
    const bucketPathIndex = pathname.indexOf(publicBucketPath);

    if (bucketPathIndex === -1) {
      return null;
    }

    return decodeURIComponent(
      pathname.slice(bucketPathIndex + publicBucketPath.length)
    );
  } catch {
    return null;
  }
}

export default function ChaptersAdminPage() {
  const [manga, setManga] = useState<Manga[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [selectedManga, setSelectedManga] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");

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

    if (error || !profile || profile.role !== "admin") {
      window.location.href = "/admin";
      return false;
    }

    setAuthorized(true);
    return true;
  }

  async function loadData() {
    const supabase = createClient();

    const { data: mangaData, error: mangaError } = await supabase
      .from("manga")
      .select("id, title")
      .order("created_at", { ascending: false });

    if (mangaError) {
      console.error(mangaError);
      setMessage("حدث خطأ أثناء تحميل المانجا.");
      return;
    }

    setManga(mangaData ?? []);

    const { data: chapterData, error: chapterError } = await supabase
      .from("chapters")
      .select("*")
      .order("chapter_number", { ascending: true });

    if (chapterError) {
      console.error(chapterError);
      setMessage("حدث خطأ أثناء تحميل الفصول.");
      return;
    }

    setChapters(chapterData ?? []);
  }

  useEffect(() => {
    async function start() {
      const isAdmin = await checkAdmin();

      if (!isAdmin) {
        setLoading(false);
        return;
      }

      await loadData();
      setLoading(false);
    }

    start();
  }, []);

  async function addChapter(e: React.FormEvent) {
    e.preventDefault();

    if (!authorized) return;

    if (!selectedManga) {
      setMessage("اختر المانجا أولًا.");
      return;
    }

    if (!chapterNumber) {
      setMessage("اكتب رقم الفصل.");
      return;
    }

    setSaving(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.from("chapters").insert({
      manga_id: Number(selectedManga),
      chapter_number: Number(chapterNumber),
      title: chapterTitle.trim() || null,
    });

    if (error) {
      console.error(error);
      setMessage(`حدث خطأ: ${error.message}`);
      setSaving(false);
      return;
    }

    setChapterNumber("");
    setChapterTitle("");

    setMessage("تمت إضافة الفصل بنجاح! 🎉");

    await loadData();

    setSaving(false);
  }

  async function deleteChapter(id: number) {
    if (!authorized) return;

    const confirmed = window.confirm(
      "هل أنت متأكد أنك تريد حذف هذا الفصل؟"
    );

    if (!confirmed) return;

    const supabase = createClient();

    let storageCleanupWarning = "";
    const { data: pageRows, error: pagesError } = await supabase
      .from("pages")
      .select("image_url")
      .eq("chapter_id", id);

    if (pagesError) {
      storageCleanupWarning =
        " تعذر فحص صور التخزين؛ راجعها يدويًا.";
    } else {
      const storagePaths = (pageRows ?? [])
        .map((page) => getMangaPageStoragePath(page.image_url))
        .filter((path): path is string => Boolean(path));

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("manga-pages")
          .remove(storagePaths);

        if (storageError) {
          storageCleanupWarning =
            " تعذر حذف بعض الصور من Storage؛ راجع صلاحيات التخزين.";
        }
      }
    }

    const { error } = await supabase
      .from("chapters")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage(`حدث خطأ: ${error.message}`);
      return;
    }

    setMessage(`تم حذف الفصل من الموقع.${storageCleanupWarning}`);

    await loadData();
  }

  function getMangaTitle(mangaId: number) {
    const item = manga.find((m) => m.id === mangaId);
    return item?.title ?? "مانجا غير معروفة";
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900"
      >
        <p>جاري التحقق من الصلاحيات...</p>
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
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <h1 className="text-lg font-bold tracking-widest sm:text-2xl">
            AL TITIZE ADMIN
          </h1>

          <a
            href="/admin"
            className="whitespace-nowrap text-sm text-gray-500 transition hover:text-black"
          >
            ← لوحة التحكم
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <p className="text-sm font-semibold text-gray-500">
            CHAPTERS
          </p>

          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            إدارة الفصول
          </h2>

          <p className="mt-3 text-sm text-gray-500 sm:text-base">
            إنشاء وإدارة فصول المانجا.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h3 className="text-xl font-bold sm:text-2xl">
            إضافة فصل جديد
          </h3>

          <form
            onSubmit={addChapter}
            className="mt-6 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                المانجا
              </label>

              <select
                value={selectedManga}
                onChange={(e) => setSelectedManga(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
              >
                <option value="">
                  اختر المانجا
                </option>

                {manga.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                رقم الفصل
              </label>

              <input
                type="number"
                min="1"
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value)}
                placeholder="مثال: 1"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                اسم الفصل
              </label>

              <input
                type="text"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="مثال: البداية"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saving ? "جاري الحفظ..." : "إضافة الفصل"}
            </button>
          </form>

          {message && (
            <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {message}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h3 className="mb-6 text-2xl font-bold">
            الفصول الموجودة
          </h3>

          {chapters.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              لا توجد فصول حاليًا.
            </div>
          ) : (
            <div className="space-y-4">
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {getMangaTitle(chapter.manga_id)}
                    </p>

                    <h4 className="mt-1 text-xl font-bold">
                      الفصل {chapter.chapter_number}
                    </h4>

                    {chapter.title && (
                      <p className="mt-1 text-sm text-gray-500">
                        {chapter.title}
                      </p>
                    )}

                    {chapter.scanlation_groups?.length ? (
                      <p className="mt-2 text-xs text-gray-500">
                        فرق الترجمة: {chapter.scanlation_groups
                          .map((group) => group.name)
                          .join("، ")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {chapter.mangadex_chapter_id ? (
                      <a
                        href={`https://mangadex.org/chapter/${chapter.mangadex_chapter_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-black hover:bg-gray-50 hover:text-black active:scale-95"
                      >
                        مصدر MangaDex
                      </a>
                    ) : null}

                    <a
                      href={`/manga/${chapter.manga_id}/chapter/${chapter.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-black hover:bg-gray-50 hover:text-black active:scale-95"
                    >
                      📖 قراءة الفصل
                    </a>

                    <button
                      type="button"
                      onClick={() => deleteChapter(chapter.id)}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-95"
                    >
                      🗑️ حذف
                    </button>
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
