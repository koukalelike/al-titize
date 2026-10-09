"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(`تعذر إنشاء الحساب: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("تم إنشاء الحساب. تحقق من بريدك الإلكتروني إذا طُلب منك ذلك.");
    setLoading(false);
    window.setTimeout(() => router.replace("/login"), 1800);
  }

  return (
    <main dir="rtl" className="auth-page">
      <div aria-hidden="true" className="auth-glow" />
      <Link href="/" className="auth-brand">
        <span className="brand-mark">A</span>
        <span><strong>AL TITIZE</strong><small>عالمك بين الصفحات</small></span>
      </Link>

      <div className="auth-layout">
        <section className="auth-art" aria-label="انضم إلى AL TITIZE">
          <div className="auth-art-copy">
            <span className="eyebrow">خطوتك الأولى</span>
            <h1>مكتبتك<br /><span>تبدأ الآن.</span></h1>
            <p>أنشئ حسابًا واحفظ أعمالك المفضلة، ثم تابع القراءة من أي وقت.</p>
          </div>
          <div className="auth-art-stamp">AL<br /><span>TITIZE</span></div>
          <div className="auth-art-lines" />
        </section>

        <section className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-card-icon">✦</span>
            <p className="eyebrow">انضم إلى مجتمع القراء</p>
            <h2>إنشاء حساب</h2>
            <p>أكمل البيانات التالية للبدء.</p>
          </div>

          <form onSubmit={handleSignup} className="auth-form">
            <label>
              <span>البريد الإلكتروني</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required />
            </label>
            <label>
              <span>كلمة المرور</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="6 أحرف على الأقل" required />
            </label>
            <label>
              <span>تأكيد كلمة المرور</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="أعد كتابة كلمة المرور" required />
            </label>
            {message && <p className="auth-message" role="status">{message}</p>}
            <button className="button-primary auth-submit" type="submit" disabled={loading}>
              {loading ? "جارٍ إنشاء الحساب…" : "إنشاء حسابي"}<span aria-hidden="true">←</span>
            </button>
          </form>

          <div className="auth-card-footer"><span>لديك حساب؟</span><Link href="/login">تسجيل الدخول</Link></div>
          <Link href="/manga" className="auth-back">العودة إلى المكتبة</Link>
        </section>
      </div>
      <p className="auth-legal">ابدأ مجانًا، واحتفظ بقوائمك وقراءتك في مكان واحد.</p>
    </main>
  );
}
