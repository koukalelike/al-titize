# هندسة جلب البيانات في AL TITIZE

## المصادر وشكل البيانات

- **AniList GraphQL** هو المصدر المفضل للبيانات الوصفية: العنوان، الوصف، الحالة، التصنيفات، التقييم، والغلاف.
- **MangaDex REST** هو مصدر الفصول وصفحاتها. يفضّل اختيار العربية أولًا ثم الإنجليزية، ثم يواصل البحث في اللغات المتاحة إذا لم تتوفر أي منهما.
- جميع بيانات المانغا تتحول إلى `NormalizedMangaMetadata` في `lib/data-sources/types.ts`، وجميع صور الفصل تتحول إلى `NormalizedChapterPage`.

```ts
type NormalizedMangaMetadata = {
  title: string;
  description: string | null;
  status: "ongoing" | "completed" | "hiatus" | "cancelled";
  genres: string[];
  averageScore: number | null;
  coverUrl: string | null;
  source: "anilist" | "mangadex";
  sourceIds: { anilist: number | null; mangadex: string | null };
  siteUrl: string | null;
};

type NormalizedChapterPage = {
  page_number: number;
  filename: string;
  image_url: string;
  source: "mangadex" | "licensed-provider";
};
```

## حدود الطلبات والتعامل مع الأعطال

`lib/data-sources/anilist.ts` يرسل طلبات GraphQL من جهة الخادم، يخزن نتائج البحث مؤقتًا 12 ساعة داخل العملية، ويجمع الطلبات المتزامنة ويترك فاصلًا زمنيًا بينها. عند تعطل AniList أو عدم وجود تطابق عنوان دقيق، يستخدم المستورد بيانات MangaDex بدل إيقاف العملية.

`lib/mangadex.ts` يبقي طلبات REST عبر API proxy في المتصفح، ويجلب الفصل من At-Home. إذا لم تتوفر الصور كاملة الدقة لكنه أعاد `dataSaver`، يستخدمها تلقائيًا.

## استيراد المانغا من لوحة الإدارة

في `/admin/import` يمكن البحث باسم المانغا بدل إدخال رابط MangaDex. تظهر نتائج مع الأغلفة والعناوين البديلة لاختيار العمل الصحيح، ثم يحدد النظام اللغة تلقائيًا (العربية أولًا) وعدد الفصول. يبدأ الاستيراد بكل الفصول افتراضيًا، على دفعات متتابعة لا تتجاوز 100 فصل، مع انتظار 10 ثوانٍ بين الدفعات وزر لإيقاف المتابعة بعد الدفعة الحالية.

## مصدر احتياطي للفصول

`getChapterPages` في `lib/data-sources/chapter-pages.ts` يجرب MangaDex أولًا، ثم موفري Manga في Consumet عند عدم وجود صفحات. يستخدم `lib/data-sources/consumet.ts` مزودي MangaPill وMangaHere وMangaKakalot وMangaReader عبر REST، ويطابق اسم المانغا ورقم الفصل قبل طلب الصور. هذه المزودات تستخدم هنا للفصول الإنجليزية فقط حتى لا يستبدل النظام ترجمة عربية بترجمة إنجليزية. تُوحّد الصفحات إلى `NormalizedChapterPage[]` وتحمل الصور إلى Supabase مع ترويسات المصدر عند الحاجة.

يستخدم التكامل افتراضيًا `https://api.consumet.org`. يمكن تغيير عنوان خادم Consumet بإضافة `CONSUMET_API_URL` إلى `.env.local` محليًا أو إلى متغيرات بيئة الاستضافة. في الاختبار الحالي أعاد الخادم العام HTTP 451، لذلك يلزم عنوان خادم Consumet ذاتي الاستضافة أو عنوان آخر متاح في بيئة التشغيل. عنوان `localhost` مناسب للاختبار المحلي فقط؛ على Vercel يجب ضبط عنوان عام يمكن لخوادم Vercel الوصول إليه. ويمكن تغيير قائمة المزودين بفواصل عبر `CONSUMET_MANGA_PROVIDERS`، مثل `mangapill,mangahere,mangakakalot,managreader`. إذا لم يجد Consumet المانغا أو الفصل المطابق، يظل الفصل فاشلًا مع رسالة واضحة ولا تُسجل صفحات وهمية.

مراجع التكامل: [توثيق Consumet](https://docs.consumet.org) و[مستودع API الرسمي](https://github.com/consumet/api.consumet.org).

## قاعدة البيانات

الحقول الحالية (`title`, `description`, `status`, `cover_url`, `mangadex_id`) تبقى كافية لتشغيل الموقع. لتخزين معرّف AniList والتصنيفات والتقييم، شغّل مرة واحدة ملف `database/anilist-metadata-columns.sql` في Supabase SQL Editor. إذا لم تُضف الأعمدة بعد، يعيد المستورد المحاولة بالحقول القديمة حتى لا يتوقف الاستيراد.
