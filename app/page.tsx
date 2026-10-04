"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setMessage("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      setMessage(
        "تم تسجيل الدخول، لكن تعذر تحديد نوع الحساب."
      );
      setLoading(false);
      return;
    }

    setMessage("تم تسجيل الدخول بنجاح!");

    setTimeout(() => {
      if (profile.role === "admin") {
        router.push("/admin");
      } else if (profile.role === "premium") {
        router.push("/premium");
      } else {
        router.push("/manga");
      }
    }, 500);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 text-gray-900"
    >
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-6 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-[0.3em] text-black">
              AL TITIZE
            </h1>

            <p className="mt-2 text-xs font-medium tracking-[0.25em] text-gray-400">
              MANGA PLATFORM
            </p>
          </div>
        </div>
      </header>

      <section className="relative flex min-h-[calc(100vh-100px)] items-center justify-center px-6 py-16">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50 to-gray-100" />

        <div className="relative z-10 w-full max-w-6xl">
          <div className="grid items-center gap-16 lg:grid-cols-2">

            <div className="text-center lg:text-right">
              <p className="mb-5 text-sm font-bold tracking-[0.3em] text-gray-400">
                WELCOME TO AL TITIZE
              </p>

              <h2 className="text-5xl font-black leading-tight tracking-tight md:text-6xl">
                مرحبًا بكم في
                <br />
                <span className="text-black">
                  موقع AL TITIZE
                </span>
              </h2>

              <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-gray-500 lg:mx-0">
                منصتك لاكتشاف وقراءة المانجا والفصول
                المنشورة على AL TITIZE.
              </p>

              <div className="mt-8 flex justify-center lg:justify-start">
                <div className="rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-500 shadow-sm">
                  عالمك الخاص للمانجا
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md">
              <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-200/60 md:p-10">

                <div className="mb-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-lg font-black text-white">
                    AL
                  </div>

                  <h3 className="mt-5 text-2xl font-bold">
                    تسجيل الدخول
                  </h3>

                  <p className="mt-2 text-sm text-gray-500">
                    قم بتسجيل الدخول للوصول إلى حسابك
                  </p>
                </div>

                <form
                  onSubmit={handleLogin}
                  className="space-y-5"
                >
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      البريد الإلكتروني
                    </label>

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="example@email.com"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white focus:ring-2 focus:ring-black/5"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      كلمة المرور
                    </label>

                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="+++++++++"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white focus:ring-2 focus:ring-black/5"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-black px-5 py-3.5 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? "جاري تسجيل الدخول..."
                      : "تسجيل الدخول"}
                  </button>
                </form>

                {message && (
                  <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
                    {message}
                  </div>
                )}

                <div className="mt-8 border-t border-gray-100 pt-6 text-center">
                  <p className="text-xs font-semibold tracking-widest text-gray-900">
                    AL TITIZE
                  </p>

                  <p className="mt-2 text-xs text-gray-400">
                    منصة المانجا الخاصة بك
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}