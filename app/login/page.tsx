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

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");

  const [manga, setManga] = useState<Manga[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState("ongoing");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // التحقق من Admin
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
      setLoading(false);

      loadManga();
    }

    checkAdmin();
  }, []);

  // تحميل المانجا
  async function loadManga() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("manga")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setManga(data ?? []);
  }

  // إضافة مانجا
  async function addManga(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setMessage("اكتب اسم المانجا أولاً.");
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

    setMessage("تمت إضافة المانجا بنجاح! 🎉");

    await loadManga();

    setSaving(false);
  }

  // حذف مانجا
  async function deleteManga(id: number) {
    const confirmed = window.confirm(
      "هل أنت متأكد أنك تريد حذف هذه المانجا؟"
    );

    if (!confirmed) return;

    const supabase = createClient();

    const { error } = await supabase
      .from("manga")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(`حدث خطأ: ${error.message}`);
      return;
    }

    setMessage("تم حذف المانجا.");

    await loadManga();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0f] text-white">
        <p>جاري التحقق...</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0f] px-6 text-white">
        <div className="rounded-2xl border border-red-500/20 bg-[#111116] p-8 text-center">

          <h1 className="text-3xl font-bold">
            غير مصرح لك
          </h1>

          <p className="mt-3 text-gray-400">
            يجب تسجيل الدخول بحساب Admin للوصول إلى لوحة التحكم.
          </p>

          <a
            href="/login"
            className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-black"
          >
            تسجيل الدخول
          </a>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white">

      {/* Header */}
      <header className="border-b border-white/10 bg-[#111116]">

        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">

          <h1 className="text-2xl font-bold tracking-widest">
            AL TITIZE ADMIN
          </h1>

          <a
            href="/"
            className="text-sm text-gray-400 hover:text-white"
          >
            العودة للموقع
          </a>

        </div>

      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">

        {/* Title */}
        <div className="mb-10">

          <p className="text-sm text-gray-500">
            ADMIN ACCOUNT
          </p>

          <h2 className="mt-2 text-4xl font-bold">
            لوحة التحكم
          </h2>

          <p className="mt-3 text-gray-400">
            مرحبًا بك، {email}
          </p>

        </div>

        {/* Add Manga */}
        <div className="rounded-2xl border border-white/10 bg-[#111116] p-6">

          <h3 className="text-2xl font-bold">
            إضافة مانجا جديدة
          </h3>

          <p className="mt-2 text-sm text-gray-400">
            سيتم حفظ البيانات مباشرة في Supabase.
          </p>

          <form
            onSubmit={addManga}
            className="mt-6 space-y-5"
          >

            {/* Title */}
            <div>

              <label className="mb-2 block text-sm text-gray-300">
                اسم المانجا
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: THE SILENCE"
                className="w-full rounded-lg border border-white/10 bg-[#1b1b22] px-4 py-3 outline-none focus:border-white/30"
                required
              />

            </div>

            {/* Description */}
            <div>

              <label className="mb-2 block text-sm text-gray-300">
                الوصف
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب وصف المانجا..."
                rows={4}
                className="w-full resize-none rounded-lg border border-white/10 bg-[#1b1b22] px-4 py-3 outline-none focus:border-white/30"
              />

            </div>

            {/* Cover URL */}
            <div>

              <label className="mb-2 block text-sm text-gray-300">
                رابط صورة الغلاف
              </label>

              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://example.com/cover.jpg"
                className="w-full rounded-lg border border-white/10 bg-[#1b1b22] px-4 py-3 outline-none focus:border-white/30"
              />

            </div>

            {/* Status */}
            <div>

              <label className="mb-2 block text-sm text-gray-300">
                الحالة
              </label>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b22] px-4 py-3 outline-none"
              >

                <option value="ongoing">
                  مستمرة
                </option>

                <option value="completed">
                  مكتملة
                </option>

                <option value="hiatus">
                  متوقفة مؤقتًا
                </option>

              </select>

            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-white px-6 py-3 font-semibold text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : "إضافة المانجا"}
            </button>

          </form>

          {message && (
            <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
              {message}
            </div>
          )}

        </div>

        {/* Manga List */}
        <div className="mt-10">

          <h3 className="mb-6 text-2xl font-bold">
            المانجا الموجودة
          </h3>

          {manga.length === 0 ? (
            <p className="text-gray-400">
              لا توجد مانجا.
            </p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

              {manga.map((item) => (

                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-[#111116]"
                >

                  <div className="flex h-48 items-center justify-center bg-[#1b1b22]">

                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-500">
                        لا توجد صورة
                      </span>
                    )}

                  </div>

                  <div className="p-5">

                    <h4 className="text-xl font-bold">
                      {item.title}
                    </h4>

                    <p className="mt-2 text-sm text-gray-400">
                      {item.description || "لا يوجد وصف."}
                    </p>

                    <p className="mt-3 text-xs text-gray-500">
                      {item.status}
                    </p>

                    <button
                      onClick={() => deleteManga(item.id)}
                      className="mt-5 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                    >
                      حذف المانجا
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