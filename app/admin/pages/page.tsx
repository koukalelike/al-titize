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
};

type PageItem = {
  id: number;
  page_number: number;
  image_url: string;
};

export default function PagesAdminPage() {
  const [manga, setManga] = useState<Manga[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);

  const [selectedManga, setSelectedManga] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");

  const [files, setFiles] = useState<FileList | null>(null);

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
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

  async function loadManga() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("manga")
      .select("id, title")
      .order("title");

    if (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء تحميل المانجا.");
      return;
    }

    setManga(data ?? []);
  }

  useEffect(() => {
    async function start() {
      const isAdmin = await checkAdmin();

      if (!isAdmin) {
        setLoading(false);
        return;
      }

      await loadManga();
      setLoading(false);
    }

    start();
  }, []);

  async function loadChapters(mangaId: string) {
    if (!authorized) return;

    setSelectedManga(mangaId);
    setSelectedChapter("");
    setPages([]);
    setMessage("");

    if (!mangaId) {
      setChapters([]);
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("chapters")
      .select("*")
      .eq("manga_id", Number(mangaId))
      .order("chapter_number");

    if (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء تحميل الفصول.");
      return;
    }

    setChapters(data ?? []);
  }

  async function loadPages(chapterId: string) {
    if (!authorized) return;

    setSelectedChapter(chapterId);
    setMessage("");

    if (!chapterId) {
      setPages([]);
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("pages")
      .select("id, page_number, image_url")
      .eq("chapter_id", Number(chapterId))
      .order("page_number");

    if (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء تحميل الصفحات.");
      return;
    }

    setPages(data ?? []);
  }

  async function uploadPages(e: React.FormEvent) {
    e.preventDefault();

    if (!authorized) return;

    if (!selectedManga) {
      setMessage("اختر المانجا أولًا.");
      return;
    }

    if (!selectedChapter) {
      setMessage("اختر الفصل أولًا.");
      return;
    }

    if (!files || files.length === 0) {
      setMessage("اختر صور الصفحات أولًا.");
      return;
    }

    setUploading(true);
    setMessage("");

    const supabase = createClient();

    try {
      const sortedFiles = Array.from(files).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );

      const { count } = await supabase
        .from("pages")
        .select("*", { count: "exact", head: true })
        .eq("chapter_id", Number(selectedChapter));

      let pageNumber = (count ?? 0) + 1;

      for (const file of sortedFiles) {
        const fileExtension =
          file.name.split(".").pop()?.toLowerCase() || "jpg";

        const filePath = `chapter-${selectedChapter}/page-${pageNumber}-${Date.now()}.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("manga-pages")
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from("manga-pages")
          .getPublicUrl(filePath);

        const { error: pageError } = await supabase
          .from("pages")
          .insert({
            chapter_id: Number(selectedChapter),
            page_number: pageNumber,
            image_url: publicUrlData.publicUrl,
          });

        if (pageError) {
          throw pageError;
        }

        pageNumber++;
      }

      setFiles(null);

      const input = document.getElementById(
        "page-files"
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await loadPages(selectedChapter);

      setMessage(`تم رفع ${sortedFiles.length} صفحة بنجاح! 🎉`);
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setMessage(`حدث خطأ: ${error.message}`);
      } else {
        setMessage("حدث خطأ أثناء رفع الصفحات.");
      }
    }

    setUploading(false);
  }

  async function deletePage(page: PageItem) {
    if (!authorized) return;

    const confirmed = window.confirm(
      `هل تريد حذف الصفحة رقم ${page.page_number}؟`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(page.id);
    setMessage("");

    const supabase = createClient();

    try {
      const marker = "/storage/v1/object/public/manga-pages/";
      const markerIndex = page.image_url.indexOf(marker);

      if (markerIndex === -1) {
        throw new Error("لم يتم العثور على مسار الصورة.");
      }

      const filePath = decodeURIComponent(
        page.image_url.substring(markerIndex + marker.length)
      );

      const { error: storageError } = await supabase.storage
        .from("manga-pages")
        .remove([filePath]);

      if (storageError) {
        throw storageError;
      }

      const { error: pageError } = await supabase
        .from("pages")
        .delete()
        .eq("id", page.id);

      if (pageError) {
        throw pageError;
      }

      setPages((current) =>
        current.filter((item) => item.id !== page.id)
      );

      setMessage("تم حذف الصفحة بنجاح 🗑️");
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setMessage(`حدث خطأ أثناء الحذف: ${error.message}`);
      } else {
        setMessage("حدث خطأ أثناء حذف الصفحة.");
      }
    }

    setDeleting(null);
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

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <p className="text-sm font-semibold text-gray-500">
            PAGES
          </p>

          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            إدارة صفحات المانجا
          </h2>

          <p className="mt-3 text-sm text-gray-500 sm:text-base">
            ارفع صفحات جديدة أو احذف الصفحات التي لا تريدها.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <form
            onSubmit={uploadPages}
            className="space-y-6"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                المانجا
              </label>

              <select
                value={selectedManga}
                onChange={(e) => loadChapters(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
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
                الفصل
              </label>

              <select
                value={selectedChapter}
                onChange={(e) => loadPages(e.target.value)}
                disabled={!selectedManga}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  اختر الفصل
                </option>

                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    الفصل {chapter.chapter_number}
                    {chapter.title ? ` — ${chapter.title}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                صور الصفحات
              </label>

              <input
                id="page-files"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                className="block w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700"
              />

              <p className="mt-2 text-xs text-gray-500">
                يمكنك اختيار عدة صور في نفس الوقت.
              </p>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
            >
              {uploading
                ? "جاري رفع الصفحات..."
                : "رفع الصفحات"}
            </button>
          </form>

          {message && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {message}
            </div>
          )}
        </div>

        {selectedChapter && (
          <div className="mt-10">
            <h3 className="mb-5 text-2xl font-bold">
              صفحات الفصل
            </h3>

            {pages.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
                لا توجد صفحات في هذا الفصل.
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map((page) => (
                  <div
                    key={page.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="aspect-[3/4] bg-gray-100">
                      <img
                        src={page.image_url}
                        alt={`صفحة ${page.page_number}`}
                        className="h-full w-full object-contain"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 p-4">
                      <span className="font-semibold">
                        صفحة {page.page_number}
                      </span>

                      <button
                        type="button"
                        onClick={() => deletePage(page)}
                        disabled={deleting === page.id}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                      >
                        {deleting === page.id
                          ? "جاري الحذف..."
                          : "🗑️ حذف"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}