"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");

    if (password.length < 6) {
      setMessage("كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      console.error("SIGNUP ERROR:", error);

      setMessage(`خطأ: ${error.message}`);
      setLoading(false);
      return;
    }

    console.log("SIGNUP SUCCESS:", data);

    setMessage(
      "تم إنشاء الحساب بنجاح. تحقق من بريدك الإلكتروني إذا طُلب منك ذلك."
    );

    setLoading(false);

    setTimeout(() => {
      router.push("/");
    }, 2000);
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-gray-50 px-6 text-gray-900"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-widest">
            AL TITIZE
          </h1>

          <p className="mt-3 text-gray-500">
            إنشاء حساب جديد
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-200/50">
          <form onSubmit={handleSignup} className="space-y-5">
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-black/5"
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
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-black/5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                تأكيد كلمة المرور
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-black/5"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black px-5 py-3.5 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}
            </button>
          </form>

          {message && (
            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
              {message}
            </div>
          )}

          <div className="mt-6 border-t border-gray-100 pt-6 text-center">
            <p className="text-sm text-gray-500">
              لديك حساب بالفعل؟
            </p>

            <a
              href="/"
              className="mt-2 inline-block font-semibold text-black hover:underline"
            >
              تسجيل الدخول
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}