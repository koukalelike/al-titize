"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SupportMessage = {
  id: number;
  message: string;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export default function CustomerSupport() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const isAdmin =
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/signup";

  async function loadMessages() {
    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessages([]);
        return;
      }

      const { data, error } = await supabase
        .from("support_messages")
        .select("id, message, reply, replied_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "فشل تحميل رسائل خدمة العملاء:",
          error.message
        );
        return;
      }

      setMessages(data ?? []);
    } catch (error) {
      console.error(
        "حدث خطأ أثناء تحميل رسائل خدمة العملاء:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      return;
    }

    if (!open) {
      return;
    }

    void Promise.resolve().then(loadMessages);
  }, [open, isAdmin]);

  async function sendMessage() {
    if (!message.trim()) {
      setStatus("اكتب رسالتك أولاً.");
      return;
    }

    setSending(true);
    setStatus("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("يجب تسجيل الدخول أولاً.");
        return;
      }

      const { error } = await supabase
        .from("support_messages")
        .insert({
          user_id: user.id,
          message: message.trim(),
        });

      if (error) {
        console.error(
          "فشل إرسال رسالة خدمة العملاء:",
          error.message
        );

        setStatus("حدث خطأ أثناء إرسال الرسالة.");
        return;
      }

      setMessage("");
      setStatus("تم إرسال رسالتك بنجاح ✅");

      await loadMessages();
    } catch (error) {
      console.error(
        "حدث خطأ أثناء إرسال الرسالة:",
        error
      );

      setStatus("حدث خطأ أثناء إرسال الرسالة.");
    } finally {
      setSending(false);
    }
  }

  if (isAdmin) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setStatus("");
        }}
        aria-label="خدمة العملاء"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl shadow-sm transition hover:border-black hover:shadow-md"
      >
        💬
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl">
                  💬
                </div>

                <div>
                  <h3 className="text-xl font-black">
                    خدمة العملاء
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    تواصل معنا وسنساعدك
                  </p>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-6">
              <div className="mb-5 rounded-2xl bg-gray-50 p-4">
                <p className="text-sm leading-7 text-gray-600">
                  👋 مرحباً بك في AL TITIZE.
                  <br />
                  إذا واجهت مشكلة أو لديك سؤال، أرسل لنا رسالة.
                </p>
              </div>

              {loading ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  جاري تحميل الرسائل...
                </div>
              ) : messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                          👤
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-gray-400">
                            رسالتك
                          </p>

                          <p className="mt-2 text-sm leading-7 text-gray-700">
                            {item.message}
                          </p>

                          <p className="mt-2 text-[10px] text-gray-400">
                            {new Date(
                              item.created_at
                            ).toLocaleString("ar-MA")}
                          </p>
                        </div>
                      </div>

                      {item.reply ? (
                        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="flex gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                              👨‍💼
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-gray-400">
                                رد خدمة العملاء
                              </p>

                              <p className="mt-2 text-sm leading-7 text-gray-700">
                                {item.reply}
                              </p>

                              {item.replied_at && (
                                <p className="mt-2 text-[10px] text-gray-400">
                                  {new Date(
                                    item.replied_at
                                  ).toLocaleString("ar-MA")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 text-center text-xs text-gray-400">
                          ⏳ في انتظار رد خدمة العملاء...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-gray-400">
                  لا توجد رسائل سابقة.
                </div>
              )}

              <div className="mt-6">
                <label className="mb-2 block text-sm font-bold">
                  رسالة جديدة
                </label>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="اكتب مشكلتك أو سؤالك هنا..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 outline-none transition focus:border-black focus:bg-white"
                />
              </div>

              {status && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-600">
                  {status}
                </div>
              )}

              <button
                onClick={sendMessage}
                disabled={sending}
                className="mt-5 w-full rounded-xl bg-black px-5 py-3.5 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "جاري الإرسال..." : "إرسال الرسالة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
