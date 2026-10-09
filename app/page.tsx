import Link from "next/link";

const features = [
  { icon: "✦", title: "اكتشف قصتك التالية", description: "ابحث في مكتبة مرتبة، واعثر على أعمال تناسب ذوقك." },
  { icon: "▤", title: "تابع من حيث توقفت", description: "احتفظ بمفضلاتك وتقدم القراءة في مكان واحد." },
  { icon: "↗", title: "قراءة بلا تشتيت", description: "واجهة هادئة وسريعة على الهاتف والحاسوب." },
];

export default function HomePage() {
  return (
    <main dir="rtl" className="landing-page">
      <div aria-hidden="true" className="landing-noise" />
      <header className="site-header">
        <Link href="/" className="site-brand" aria-label="AL TITIZE الرئيسية">
          <span className="brand-mark">A</span>
          <span><strong>AL TITIZE</strong><small>عالمك بين الصفحات</small></span>
        </Link>
        <nav className="site-nav" aria-label="التنقل الرئيسي">
          <Link href="/manga">المكتبة</Link>
          <Link href="/premium">العضوية</Link>
          <Link href="/login" className="nav-login">تسجيل الدخول</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> منصة قراءة واكتشاف المانغا</div>
          <h1>حكاياتٌ<br /><span>تستحق أن تُقرأ.</span></h1>
          <p>ادخل عوالم جديدة، تابع فصولك المفضلة، واكتشف العمل التالي الذي سيأخذك معه.</p>
          <div className="hero-actions">
            <Link href="/manga" className="button-primary">اكتشف المكتبة <span aria-hidden="true">←</span></Link>
            <Link href="/signup" className="button-secondary">أنشئ حسابًا</Link>
          </div>
          <div className="hero-proof">
            <span className="proof-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>مكتبتك، مفضلاتك، وقراءتك في مكان واحد</span>
          </div>
        </div>

        <div className="hero-art" aria-label="تصميم فني تجريدي مستوحى من صفحات المانغا">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-spark spark-one">✦</div>
          <div className="art-spark spark-two">✧</div>
          <div className="manga-panel panel-back">
            <span className="panel-caption">VOL. 01</span><div className="panel-sun" />
            <div className="panel-lines"><i /><i /><i /></div>
          </div>
          <div className="manga-panel panel-front">
            <div className="panel-topline"><span>AL</span><span>STORIES</span></div>
            <div className="panel-figure"><div className="figure-halo" /><div className="figure-head" /><div className="figure-body" /></div>
            <div className="panel-title">اقرأ<br /><b>العالم</b></div>
            <div className="panel-bottomline"><span>01 — 28</span><span>تابع رحلتك</span></div>
          </div>
          <div className="art-note">قصة جديدة<br /><strong>تنتظرك</strong></div>
        </div>
      </section>

      <section className="feature-section" aria-label="مميزات الموقع">
        <div className="section-heading">
          <div><span className="eyebrow">مصممة للقراءة</span><h2>كل ما تحتاجه، <span>ببساطة.</span></h2></div>
          <p>ابدأ الآن، واجعل AL TITIZE مكتبتك اليومية.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature, index) => (
            <article className="feature-card" key={feature.title}>
              <span className="feature-index">0{index + 1}</span><span className="feature-icon">{feature.icon}</span>
              <h3>{feature.title}</h3><p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer"><span>© AL TITIZE</span><span>قصص تُقرأ، وعوالم تبقى.</span><Link href="/manga">ابدأ الاستكشاف ↗</Link></footer>
    </main>
  );
}
