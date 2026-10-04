"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  role: string;
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");

  async function checkAdmin() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return false;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      window.location.href = "/admin";
      return false;
    }

    setAuthorized(true);
    return true;
  }

  async function loadUsers() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("تعذر تحميل المستخدمين.");
    } else {
      setUsers(data ?? []);
    }
  }

  useEffect(() => {
    async function start() {
      const isAdmin = await checkAdmin();

      if (!isAdmin) {
        setLoading(false);
        return;
      }

      await loadUsers();
      setLoading(false);
    }

    start();
  }, []);

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
          <div>
            <p className="text-xs font-semibold tracking-widest text-gray-400">
              AL TITIZE ADMIN
            </p>

            <h1 className="mt-1 text-xl font-bold sm:text-2xl">
              إدارة المستخدمين
            </h1>
          </div>

          <a
            href="/admin"
            className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-black hover:text-black active:scale-95 sm:px-4"
          >
            ← لوحة التحكم
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <p className="text-sm font-semibold text-gray-500">
            USERS
          </p>

          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            المستخدمون
          </h2>

          <p className="mt-3 text-sm text-gray-500 sm:text-base">
            عرض حسابات المستخدمين المسجلة في منصة AL TITIZE.
          </p>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-sm text-gray-500">
              إجمالي الحسابات
            </p>

            <p className="mt-2 text-3xl font-bold">
              {users.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-sm text-gray-500">
              المدراء
            </p>

            <p className="mt-2 text-3xl font-bold">
              {users.filter((user) => user.role === "admin").length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-sm text-gray-500">
              المستخدمون العاديون
            </p>

            <p className="mt-2 text-3xl font-bold">
              {users.filter((user) => user.role !== "admin").length}
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-center text-red-600">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="text-gray-500">
              لا يوجد مستخدمون حاليًا.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-right">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold">
                      المستخدم
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold">
                      الصلاحية
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold">
                      تاريخ التسجيل
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-6 py-5">
                        <p className="break-all font-medium">
                          {user.id}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          User ID
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        {user.role === "admin" ? (
                          <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                            Admin
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                            User
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-5 text-sm text-gray-500">
                        {new Date(
                          user.created_at
                        ).toLocaleDateString("ar-MA", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}