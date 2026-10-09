"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: number;
  title: string;
  message: string;
  created_at: string;
};

export default function AdminNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    setNotifications(data ?? []);
  }, []);

  const checkAdmin = useCallback(async () => {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

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

    await loadNotifications();

    setLoading(false);
  }, [loadNotifications]);

  useEffect(() => {
    void Promise.resolve().then(checkAdmin);
  }, [checkAdmin]);

  async function createNotification(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !message.trim()) {
      setStatusMessage("يرجى كتابة عنوان ورسالة الإشعار.");
      return;
    }

    setSaving(true);
    setStatusMessage("");

    const supabase = createClient();

    const { error } = await supabase.from("notifications").insert({
      title: title.trim(),
      message: message.trim(),
    });

    if (error) {
      setStatusMessage("حدث خطأ أثناء إرسال الإشعار.");
      setSaving(false);
      return;
    }

    setTitle("");
    setMessage("");

    setStatusMessage("تم إرسال الإشعار بنجاح.");

    await loadNotifications();

    setSaving(false);
  }

  async function deleteNotification(id: number) {
    const confirmed = window.confirm(
      "هل أنت متأكد من حذف هذا الإشعار؟"
    );

    if (!confirmed) return;

    const supabase = createClient();

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      setStatusMessage("تعذر حذف الإشعار.");
      return;
    }

    await loadNotifications();
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f7f8fa]"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-5 text-sm text-gray-500">
            جاري تحميل الإشعارات...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6"
      >
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl">
            🔒
          </div>

          <h1 className="mt-6 text-3xl font-black">
            غير مصرح لك
          </h1>

          <p className="mt-3 text-gray-500">
            يجب تسجيل الدخول بحساب Admin للوصول إلى هذه الصفحة.
          </p>

          <a
            href="/login"
            className="mt-7 inline-flex rounded-xl bg-black px-7 py-3 font-bold text-white transition hover:bg-gray-800"
          >
            تسجيل الدخول
          </a>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f7f8fa] text-gray-900"
    >
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl">
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
                NOTIFICATIONS
              </p>
            </div>
          </div>

          <a
            href="/admin"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:border-black hover:text-black"
          >
            لوحة التحكم
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">

        <div className="mb-8">
          <p className="text-xs font-black tracking-[0.25em] text-gray-400">
            NOTIFICATION CENTER
          </p>

          <h2 className="mt-2 text-4xl font-black">
            الإشعارات
          </h2>

          <p className="mt-3 text-sm leading-7 text-gray-500">
            أرسل رسالة تظهر لمستخدمي AL TITIZE.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">

          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-xl">
              🔔
            </div>

            <div>
              <h3 className="text-xl font-black">
                إرسال إشعار جديد
              </h3>

              <p className="text-xs text-gray-500">
                سيظهر الإشعار لجميع المستخدمين.
              </p>
            </div>
          </div>

          <form
            onSubmit={createNotification}
            className="space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-bold">
                عنوان الإشعار
              </label>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: فصل جديد متوفر"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 outline-none transition focus:border-black focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                الرسالة
              </label>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="اكتب رسالة الإشعار هنا..."
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 outline-none transition focus:border-black focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-black px-5 py-3.5 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "جاري الإرسال..." : "إرسال الإشعار"}
            </button>
          </form>

          {statusMessage && (
            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
              {statusMessage}
            </div>
          )}
        </div>

        <div className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-black tracking-[0.25em] text-gray-400">
              HISTORY
            </p>

            <h3 className="mt-2 text-2xl font-black">
              الإشعارات السابقة
            </h3>
          </div>

          {notifications.length === 0 ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
              <div className="text-4xl">🔔</div>

              <p className="mt-4 font-bold">
                لا توجد إشعارات حتى الآن.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                        🔔
                      </div>

                      <div>
                        <h4 className="font-black">
                          {notification.title}
                        </h4>

                        <p className="mt-2 text-sm leading-7 text-gray-500">
                          {notification.message}
                        </p>

                        <p className="mt-3 text-xs text-gray-400">
                          {new Date(
                            notification.created_at
                          ).toLocaleString("ar-MA")}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        deleteNotification(notification.id)
                      }
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-500 transition hover:bg-red-50"
                    >
                      حذف
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
