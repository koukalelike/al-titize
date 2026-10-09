"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SupportMessage = {
  id: number;
  user_id: string;
  message: string;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export default function AdminSupportPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const loadMessages = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setMessages(data ?? []);
    }
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
    await loadMessages();
    setLoading(false);
  }, [loadMessages]);

  useEffect(() => {
    void Promise.resolve().then(checkAdmin);
  }, [checkAdmin]);

  async function sendReply(id: number) {
    const reply = replies[id]?.trim();

    if (!reply) {
      setStatusMessage("يرجى كتابة الرد أولاً.");
      return;
    }

    setSaving(id);
    setStatusMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("support_messages")
      .update({
        reply,
        replied_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setStatusMessage("حدث خطأ أثناء إرسال الرد.");
      setSaving(null);
      return;
    }

    setReplies((current) => ({
      ...current,
      [id]: "",
    }));

    setStatusMessage("تم إرسال الرد بنجاح.");

    await loadMessages();
    setSaving(null);
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
            جاري تحميل خدمة العملاء...
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
                CUSTOMER SERVICE
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
            CUSTOMER SUPPORT
          </p>

          <h2 className="mt-2 text-4xl font-black">
            خدمة العملاء
          </h2>

          <p className="mt-3 text-sm leading-7 text-gray-500">
            استقبل رسائل المستخدمين وأجب عن أسئلتهم ومشاكلهم.
          </p>
        </div>

        {statusMessage && (
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 text-center text-sm font-bold text-gray-600">
            {statusMessage}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="text-5xl">
              💬
            </div>

            <h3 className="mt-5 text-xl font-black">
              لا توجد رسائل
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              عندما يرسل مستخدم رسالة، ستظهر هنا.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl">
                    👤
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-black">
                        رسالة مستخدم
                      </h3>

                      <p className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString("ar-MA")}
                      </p>
                    </div>

                    <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-7 text-gray-700">
                      {item.message}
                    </p>

                    {item.reply && (
                      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-xs font-black text-gray-400">
                          رد الإدارة
                        </p>

                        <p className="mt-2 text-sm leading-7 text-gray-600">
                          {item.reply}
                        </p>

                        {item.replied_at && (
                          <p className="mt-2 text-xs text-gray-400">
                            {new Date(
                              item.replied_at
                            ).toLocaleString("ar-MA")}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-5">
                      <textarea
                        value={replies[item.id] ?? ""}
                        onChange={(e) =>
                          setReplies((current) => ({
                            ...current,
                            [item.id]: e.target.value,
                          }))
                        }
                        rows={3}
                        placeholder="اكتب ردك للمستخدم..."
                        className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white"
                      />

                      <button
                        onClick={() => sendReply(item.id)}
                        disabled={saving === item.id}
                        className="mt-3 w-full rounded-xl bg-black px-5 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {saving === item.id
                          ? "جاري الإرسال..."
                          : "إرسال الرد"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
