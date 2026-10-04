"use client";

import { useEffect, useRef, useState } from "react";
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
  const [status, setStatus] = useState("ongoing");

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingCoverFile, setEditingCoverFile] = useState<File | null>(null);
  const [editingCoverPreview, setEditingCoverPreview] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("يرجى اختيار صورة فقط.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("حجم الغلاف يجب أن يكون أقل من 10MB.");
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setMessage("");
  }

  function removeCover() {
    setCoverFile(null);
    setCoverPreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleEditCoverChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("يرجى اختيار صورة فقط.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("حجم الغلاف يجب أن يكون أقل من 10MB.");
      return;
    }

    setEditingCoverFile(file);
    setEditingCoverPreview(URL.createObjectURL(file));
    setMessage("");
  }

  function startEditing(item: Manga) {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setStatus(item.status);
    setEditingCoverFile(null);
    setEditingCoverPreview(item.cover_url);
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingCoverFile(null);
    setEditingCoverPreview(null);

    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }

    setTitle("");
    setDescription("");
    setStatus("ongoing");
    setMessage("");
  }

  async function uploadCover(
    supabase: ReturnType<typeof createClient>,
    file: File
  ) {
    const fileExtension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `cover-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExtension}`;

    const filePath = `covers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("manga-pages")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(
        `فشل رفع الغلاف: ${uploadError.message}`
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("manga-pages")
      .getPublicUrl(filePath);

    return publicUrl;
  }

  async function addManga(e: React.FormEvent) {
    e.preventDefault();

    if (!authorized || saving) {
      return;
    }

    if (!title.trim()) {
      setMessage("اكتب اسم المانجا أولًا.");
      return;
    }

    if (!coverFile) {
      setMessage("اختر غلاف المانجا أولًا.");
      return;
    }

    setSaving(true);
    setMessage("");

    const supabase = createClient();

    try {
      const coverUrl = await uploadCover(supabase, coverFile);

      const { error } = await supabase.from("manga").insert({
        title: title.trim(),
        description: description.trim() || null,
        cover_url: coverUrl,
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
      setStatus("ongoing");
      removeCover();

      await loadManga();

      setMessage("تمت إضافة المانجا والغلاف بنجاح! 🎉");
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء رفع الغلاف."
      );
    }

    setSaving(false);
  }

  async function updateManga(e: React.FormEvent) {
    e.preventDefault();

    if (!authorized || saving || editingId === null) {
      return;
    }

    if (!title.trim()) {
      setMessage("اكتب اسم المانجا أولًا.");
      return;
    }

    setSaving(true);
    setMessage("");

    const supabase = createClient();

    try {
      let coverUrl: string | null | undefined = undefined;

      if (editingCoverFile) {
        coverUrl = await uploadCover(
          supabase,
          editingCoverFile
        );
      }

      const updateData: {
        title: string;
        description: string | null;
        status: string;
        cover_url?: string;
      } = {
        title: title.trim(),
        description: description.trim() || null,
        status,
      };

      if (coverUrl) {
        updateData.cover_url = coverUrl;
      }

      const { error } = await supabase
        .from("manga")
        .update(updateData)
        .eq("id", editingId);

      if (error) {
        console.error(error);
        setMessage(`حدث خطأ أثناء التعديل: ${error.message}`);
        setSaving(false);
        return;
      }

      await loadManga();

      cancelEditing();

      setMessage("تم تعديل المانجا بنجاح! ✨");
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تعديل المانجا."
      );
    }

    setSaving(false);
  }

  async function deleteManga(id: number) {
    if (!authorized) {
      return;
    }

    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذه المانجا؟\n\nسيتم حذف المانجا من الموقع."
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

    if (editingId === id) {
      cancelEditing();
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
        className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-900"
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

  const editingManga = manga.find(
    (item) => item.id === editingId
  );

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-[#f7f8fa] text-gray-900"
    >
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[10px] font-black tracking-[0.3em] text-gray-400">
              AL TITIZE
            </p>

            <h1 className="mt-1 text-lg font-black tracking-wide sm:text-2xl">
              إدارة المانجا
            </h1>
          </div>

          <a
            href="/admin"
            className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-600 shadow-sm transition hover:-translate-y-0.5 hover:border-black hover:text-black hover:shadow-md sm:text-sm"
          >
            <span>لوحة التحكم</span>
            <span>←</span>
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* PAGE HEADER */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-500 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            MANGA MANAGEMENT
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
            مكتبة المانجا
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-500 sm:text-base">
            أضف أعمالك، اختر الأغلفة من جهازك، وقم بإدارة مكتبة
            AL TITIZE بسهولة.
          </p>
        </div>

        {/* ADD / EDIT MANGA */}
        <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gradient-to-l from-gray-50 to-white px-5 py-6 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-xl text-white shadow-lg">
                  {editingId ? "✏️" : "＋"}
                </div>

                <div>
                  <h3 className="text-xl font-black">
                    {editingId
                      ? "تعديل المانجا"
                      : "إضافة مانجا جديدة"}
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    {editingId
                      ? `تعديل بيانات ${editingManga?.title ?? "المانجا"}`
                      : "أضف المعلومات والغلاف ثم انشر العمل."}
                  </p>
                </div>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:border-black hover:text-black"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>
          </div>

          <form
            onSubmit={editingId ? updateManga : addManga}
            className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[1fr_360px]"
          >
            {/* INFO */}
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">
                  اسم المانجا
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  placeholder="مثال: THE SILENCE"
                  className="min-h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white focus:ring-4 focus:ring-gray-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">
                  الوصف
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="اكتب وصف المانجا..."
                  rows={6}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white focus:ring-4 focus:ring-gray-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">
                  الحالة
                </label>

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value)
                  }
                  className="min-h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white focus:ring-4 focus:ring-gray-100"
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
            </div>

            {/* COVER */}
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">
                غلاف المانجا
              </label>

              <input
                ref={
                  editingId
                    ? editFileInputRef
                    : fileInputRef
                }
                type="file"
                accept="image/*"
                onChange={
                  editingId
                    ? handleEditCoverChange
                    : handleCoverChange
                }
                className="hidden"
              />

              {editingId ? (
                editingCoverPreview ? (
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
                    <div className="aspect-[3/4]">
                      <img
                        src={editingCoverPreview}
                        alt="غلاف المانجا"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
                      <button
                        type="button"
                        onClick={() =>
                          editFileInputRef.current?.click()
                        }
                        className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black shadow-lg transition hover:bg-gray-100"
                      >
                        🔄 تغيير الغلاف
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      editFileInputRef.current?.click()
                    }
                    className="group flex aspect-[3/4] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 text-center transition hover:border-black hover:bg-white"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                      🖼️
                    </div>

                    <p className="mt-5 text-base font-black">
                      اختر غلافًا جديدًا
                    </p>

                    <p className="mt-2 text-xs leading-5 text-gray-400">
                      اضغط هنا لفتح معرض الصور
                    </p>

                    <span className="mt-5 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white">
                      📁 اختيار صورة
                    </span>
                  </button>
                )
              ) : coverPreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
                  <div className="aspect-[3/4]">
                    <img
                      src={coverPreview}
                      alt="معاينة الغلاف"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black shadow-lg transition hover:bg-gray-100"
                      >
                        🔄 تغيير
                      </button>

                      <button
                        type="button"
                        onClick={removeCover}
                        className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-700"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  className="group flex aspect-[3/4] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 text-center transition hover:border-black hover:bg-white"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                    🖼️
                  </div>

                  <p className="mt-5 text-base font-black">
                    اختر غلافًا
                  </p>

                  <p className="mt-2 text-xs leading-5 text-gray-400">
                    اضغط هنا لفتح معرض الصور
                  </p>

                  <span className="mt-5 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white">
                    📁 اختيار صورة
                  </span>

                  <p className="mt-4 text-[10px] text-gray-400">
                    JPG · PNG · WEBP · حتى 10MB
                  </p>
                </button>
              )}
            </div>

            {/* SUBMIT */}
            <div className="lg:col-span-2">
              {message && (
                <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center text-sm font-medium leading-6 text-gray-700">
                  {message}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-14 flex-1 rounded-2xl bg-black px-6 py-4 text-base font-black text-white shadow-lg transition duration-300 hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? editingId
                      ? "⏳ جاري حفظ التعديلات..."
                      : "⏳ جاري رفع الغلاف وإضافة المانجا..."
                    : editingId
                    ? "💾 حفظ تعديلات المانجا"
                    : "🚀 إضافة المانجا ونشرها"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="min-h-14 rounded-2xl border border-gray-200 bg-white px-8 py-4 text-base font-black text-gray-600 transition hover:border-black hover:text-black disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* MANGA LIST */}
        <div className="mt-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.25em] text-gray-400">
                LIBRARY
              </p>

              <h3 className="mt-2 text-2xl font-black sm:text-3xl">
                المانجا الموجودة
              </h3>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold shadow-sm">
              {manga.length} عمل
            </div>
          </div>

          {manga.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <div className="text-5xl">
                📚
              </div>

              <p className="mt-5 text-lg font-black">
                لا توجد مانجا حاليًا
              </p>

              <p className="mt-2 text-sm text-gray-400">
                أضف أول مانجا إلى مكتبة AL TITIZE.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {manga.map((item) => (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm transition duration-500 hover:-translate-y-2 hover:shadow-2xl"
                >
                  {item.cover_url ? (
                    <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 pt-16">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black text-black">
                          {item.status === "ongoing"
                            ? "مستمرة"
                            : item.status === "completed"
                            ? "مكتملة"
                            : "متوقفة"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center bg-gray-100 text-gray-400">
                      <span className="text-5xl">
                        🖼️
                      </span>

                      <p className="mt-3 text-sm font-bold">
                        لا يوجد غلاف
                      </p>
                    </div>
                  )}

                  <div className="p-5">
                    <h4 className="truncate text-xl font-black">
                      {item.title}
                    </h4>

                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">
                      {item.description ||
                        "لا يوجد وصف."}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(item)
                        }
                        className="min-h-11 rounded-xl bg-black px-3 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
                      >
                        ✏️ تعديل
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteManga(item.id)
                        }
                        className="min-h-11 rounded-xl bg-red-50 px-3 py-3 text-sm font-bold text-red-600 transition hover:bg-red-600 hover:text-white"
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