"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: number;
  title: string;
  message: string;
  created_at: string;
};

export default function NotificationBell() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    setLoading(true);

    const supabase = createClient();

    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, created_at")
      .order("created_at", { ascending: false });

    setNotifications(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  function toggleNotifications() {
    setOpen((value) => !value);

    if (!open) {
      loadNotifications();
    }
  }

  return (
    <>
      <button
        onClick={toggleNotifications}
        aria-label="الإشعارات"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl shadow-sm transition hover:border-black hover:shadow-md"
      >
        🔔

        {notifications.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold text-white">
            {notifications.length > 99 ? "99+" : notifications.length}
          </span>
        )}
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
                  🔔
                </div>

                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    الإشعارات
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    آخر أخبار AL TITIZE
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

            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

                  <p className="mt-4 text-sm text-gray-400">
                    جاري تحميل الإشعارات...
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="text-5xl">
                    🔕
                  </div>

                  <p className="mt-4 font-bold text-gray-700">
                    لا توجد إشعارات
                  </p>

                  <p className="mt-2 text-sm text-gray-400">
                    سنخبرك عندما يكون هناك شيء جديد.
                  </p>
                </div>
              ) : (
                <div className="p-5">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="mb-3 rounded-2xl border border-gray-100 bg-gray-50 p-5 last:mb-0"
                    >
                      <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                          🔔
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-base font-black text-gray-900">
                            {notification.title}
                          </h4>

                          <p className="mt-2 text-sm leading-7 text-gray-600">
                            {notification.message}
                          </p>

                          <p className="mt-3 text-xs text-gray-400">
                            {new Date(
                              notification.created_at
                            ).toLocaleString("ar-MA")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-black px-5 py-3 font-bold text-white transition hover:bg-gray-800"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}