"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setMessage("تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      setMessage("تم تسجيل الدخول، لكن تعذر تحميل صلاحية الحساب.");
      setLoading(false);
      return;
    }

    router.replace(
      profile.role === "admin"
        ? "/admin"
        : profile.role === "premium"
          ? "/premium"
          : "/manga"
    );
  }

  return (
    <main dir="rtl" className="auth-page">
      <div aria-hidden="true" className="auth-glow" />
      <Link href="/" className="auth-brand">
        <span className="brand-mark">A</span>
        <span><strong>AL TITIZE</strong><small>عالمك بين الصفحات</small></span>
      </Link>

      <div className="auth-layout">
        <section className="auth-art" aria-label="مرحبًا بك في AL TITIZE">
          <div className="auth-art-copy">
            <span className="eyebrow">اقرأ على طريقتك</span>
            <h1>كل صفحة<br /><span>تفتح عالمًا.</span></h1>
            <p>مكان واحد لاكتشاف المانغا، متابعة الفصول، والعودة إلى قصصك المفضلة.</p>
          </div>
          <div className="auth-art-stamp">AL<br /><span>TITIZE</span></div>
          <div className="auth-art-lines" />
        </section>

        <section className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-card-icon">↗</span>
            <p className="eyebrow">مرحبًا بعودتك</p>
            <h2>تسجيل الدخول</h2>
            <p>أدخل بيانات حسابك للمتابعة.</p>
          </div>

          <form onSubmit={handleLogin} className="auth-form">
            <label>
              <span>البريد الإلكتروني</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required />
            </label>
            <label>
              <span>كلمة المرور</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="••••••••" required />
            </label>
            {message && <p className="auth-message" role="alert">{message}</p>}
            <button className="button-primary auth-submit" type="submit" disabled={loading}>
              {loading ? "جارٍ تسجيل الدخول…" : "دخول إلى حسابي"}<span aria-hidden="true">←</span>
            </button>
          </form>

          <div className="auth-card-footer"><span>مستخدم جديد؟</span><Link href="/signup">أنشئ حسابك</Link></div>
          <Link href="/manga" className="auth-back">تصفّح المكتبة دون تسجيل دخول</Link>
        </section>
      </div>
      <p className="auth-legal">بالمتابعة، ستعود إلى مكتبتك وقراءاتك المحفوظة.</p>
    </main>
  );
}
