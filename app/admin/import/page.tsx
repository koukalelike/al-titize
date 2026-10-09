"use client";

import { useRef, useState } from "react";
import {
  getMangaInfo,
  getMangaChapters,
  getMangaPreferredLanguage,
  getMangaId,
  searchMangaDexManga,
  type MangaDexSearchResult,
} from "@/lib/mangadex";
import { importChaptersBatchAction } from "./actions";

type Chapter = {
  id: string;
  chapter: string | null;
  title: string;
  language: string;
  pages: number;
  volume: string | null;
};

type ImportMode = "all" | "number";

type ChapterImportOutcome = {
  success: boolean;
  skipped: boolean;
  pages: number;
  source?: "mangadex" | "consumet";
  error?: string;
};

export default function MangaDexImportPage() {
  const [input, setInput] = useState("");
  const [searchResults, setSearchResults] = useState<MangaDexSearchResult[]>([]);
  const stopRequested = useRef(false);

  const [loading, setLoading] = useState(false);
  const [loadingChapters, setLoadingChapters] =
    useState(false);
  const [importingBatch, setImportingBatch] =
    useState(false);

  const [error, setError] = useState("");
  const [chapterError, setChapterError] =
    useState("");

  const [manga, setManga] = useState<Awaited<ReturnType<typeof getMangaInfo>> | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>(
    []
  );
  const [chapterResults, setChapterResults] = useState<
    Record<string, ChapterImportOutcome>
  >({});

  const [language, setLanguage] = useState("");

  const [importMode, setImportMode] =
    useState<ImportMode>("all");

  const [chapterLimit, setChapterLimit] =
    useState("10");

  const [totalChapters, setTotalChapters] =
    useState(0);

  const [loadedChapters, setLoadedChapters] =
    useState(0);

  const [targetChapters, setTargetChapters] =
    useState(0);

  const [currentBatch, setCurrentBatch] =
    useState(0);

  const [waiting, setWaiting] = useState(false);

  const [countdown, setCountdown] = useState(0);

  const [showChapterSettings, setShowChapterSettings] =
    useState(false);

  const [waitingForNextBatch, setWaitingForNextBatch] =
    useState(false);

  const [importSuccess, setImportSuccess] =
    useState("");

  const [importedCount, setImportedCount] =
    useState(0);

  const [skippedCount, setSkippedCount] =
    useState(0);

  const [failedCount, setFailedCount] =
    useState(0);

  const [totalImportedPages, setTotalImportedPages] =
    useState(0);

  async function handleSearch() {
    setError("");
    setChapterError("");
    setImportSuccess("");

    setManga(null);
    setSearchResults([]);
    setChapters([]);
    setChapterResults({});

    setLanguage("");

    setTotalChapters(0);
    setLoadedChapters(0);
    setTargetChapters(0);
    setCurrentBatch(0);

    setWaiting(false);
    setCountdown(0);

    setShowChapterSettings(false);
    setWaitingForNextBatch(false);

    setImportedCount(0);
    setSkippedCount(0);
    setFailedCount(0);
    setTotalImportedPages(0);

    const query = input.trim();

    if (!query) {
      setError("اكتب اسم المانغا أولًا.");
      return;
    }

    const mangaId = getMangaId(query);

    if (mangaId) {
      await handleSelectManga(mangaId);
      return;
    }

    try {
      setLoading(true);
      const results = await searchMangaDexManga(query);

      if (results.length === 0) {
        setError("لم أجد مانغا بهذا الاسم في MangaDex. جرّب اسمًا آخر.");
        return;
      }

      setSearchResults(results);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء جلب بيانات MangaDex"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectManga(mangaDexId: string) {
    setError("");
    setChapterError("");
    setImportSuccess("");
    setSearchResults([]);
    setManga(null);
    setChapters([]);
    setChapterResults({});
    setLanguage("");
    setTotalChapters(0);
    setShowChapterSettings(false);

    try {
      setLoading(true);
      const selectedManga = await getMangaInfo(mangaDexId);
      const preferred = await getMangaPreferredLanguage(selectedManga.id);

      setManga(selectedManga);

      if (!preferred.language || preferred.total <= 0) {
        setError("وجدت المانغا، لكن لم أجد لها فصولًا مترجمة في MangaDex.");
        return;
      }

      setLanguage(preferred.language);
      setTotalChapters(preferred.total);
      setShowChapterSettings(true);
      setImportMode("all");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء تحميل بيانات المانغا والفصول."
      );
    } finally {
      setLoading(false);
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) =>
      setTimeout(resolve, ms)
    );
  }

  async function waitTenSeconds() {
    setWaiting(true);

    for (
      let seconds = 10;
      seconds > 0;
      seconds--
    ) {
      if (stopRequested.current) {
        break;
      }

      setCountdown(seconds);
      await sleep(1000);
    }

    setCountdown(0);
    setWaiting(false);
  }

  async function importBatch(
    batchChapters: Chapter[]
  ): Promise<boolean> {
    if (!manga?.id) {
      setChapterError(
        "بيانات المانجا غير موجودة."
      );
      return false;
    }

    if (!batchChapters.length) {
      setChapterError(
        "لا توجد فصول في هذه الدفعة."
      );
      return false;
    }

    setChapterError("");
    setImportSuccess("");
    setImportingBatch(true);

    try {
      const result =
        await importChaptersBatchAction(
          manga.id,
          batchChapters
        );

      setChapterResults((previous) => {
        const next = { ...previous };
        for (const chapterResult of result.results) {
          next[chapterResult.chapterId] = {
            success: chapterResult.success,
            skipped: chapterResult.skipped,
            pages: chapterResult.pages,
            source: chapterResult.source,
            error: chapterResult.error,
          };
        }
        return next;
      });

      setImportedCount(
        (previous) =>
          previous + result.imported
      );

      setSkippedCount(
        (previous) =>
          previous + result.skipped
      );

      setFailedCount(
        (previous) =>
          previous + result.failed
      );

      setTotalImportedPages(
        (previous) =>
          previous + result.totalPages
      );

      if (result.error) {
        setChapterError(
          result.error
        );
      }

      if (
        result.imported > 0 ||
        result.skipped > 0
      ) {
        setImportSuccess(
          `تمت معالجة الدفعة: ${result.imported} فصل مستورد، ${result.skipped} فصل موجود مسبقًا، ${result.failed} فصل فشل. إجمالي الصفحات الجديدة: ${result.totalPages}`
        );
      }

      return !result.error;
    } catch (err) {
      setChapterError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء استيراد الدفعة."
      );

      return false;
    } finally {
      setImportingBatch(false);
    }
  }

  async function startImport() {
    if (!manga?.id) {
      setChapterError(
        "ابحث عن المانجا أولاً"
      );
      return;
    }

    if (!language) {
      setChapterError(
        "لم يتم تحديد لغة الفصول."
      );
      return;
    }

    setChapterError("");
    setImportSuccess("");
    setWaitingForNextBatch(false);
    stopRequested.current = false;

    setChapters([]);
    setChapterResults({});

    setLoadedChapters(0);
    setCurrentBatch(0);

    setImportedCount(0);
    setSkippedCount(0);
    setFailedCount(0);
    setTotalImportedPages(0);

    const requestedNumber = Math.max(
      1,
      Number(chapterLimit) || 1
    );

    const finalTarget =
      importMode === "all"
        ? totalChapters
        : Math.min(
            requestedNumber,
            totalChapters
          );

    if (finalTarget <= 0) {
      setChapterError(
        "حدد عدد الفصول أولاً."
      );
      return;
    }

    setTargetChapters(
      finalTarget
    );

    try {
      setLoadingChapters(true);

      const batchSize = Math.min(
        100,
        finalTarget
      );

      const result =
        await getMangaChapters(
          manga.id,
          language,
          batchSize,
          0
        );

      setLoadingChapters(false);

      if (stopRequested.current) {
        setImportSuccess("⏸️ تم إيقاف الاستيراد قبل بدء رفع الصفحات.");
        return;
      }

      if (
        !result.chapters ||
        result.chapters.length === 0
      ) {
        setChapterError(
          "لم يتم العثور على فصول."
        );
        return;
      }

      setChapters(
        result.chapters
      );

      const loaded =
        result.chapters.length;

      setLoadedChapters(
        loaded
      );

      setCurrentBatch(1);

      setLoadingChapters(false);

      const batchSucceeded = await importBatch(
        result.chapters
      );

      if (!batchSucceeded) {
        return;
      }

      if (stopRequested.current) {
        setImportSuccess(
          `⏸️ أوقفت الاستيراد بعد معالجة ${loaded} من ${finalTarget} فصل.`
        );
        return;
      }

      if (
        loaded >= finalTarget
      ) {
        setImportSuccess(
          "🎉 اكتمل جلب واستيراد جميع الفصول المطلوبة."
        );

        return;
      }

      setWaitingForNextBatch(
        true
      );

      await continueNextBatch(
        loaded,
        finalTarget
      );
    } catch (err) {
      setChapterError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء جلب الفصول"
      );

      setLoadingChapters(false);
    }
  }

  async function continueNextBatch(
    currentOffset: number,
    finalTarget: number
  ) {
    if (!manga?.id) {
      return;
    }

    if (currentOffset >= finalTarget || stopRequested.current) {
      return;
    }

    setChapterError("");
    setImportSuccess("");
    setWaitingForNextBatch(true);

    try {
      await waitTenSeconds();

      if (stopRequested.current) {
        setImportSuccess(
          `⏸️ أوقفت الاستيراد بعد معالجة ${currentOffset} من ${finalTarget} فصل.`
        );
        return;
      }

      setWaitingForNextBatch(false);

      setLoadingChapters(
        true
      );

      const remaining =
        finalTarget - currentOffset;

      const batchSize = Math.min(
        100,
        remaining
      );

      const result =
        await getMangaChapters(
          manga.id,
          language,
          batchSize,
          currentOffset
        );

      setLoadingChapters(false);

      if (stopRequested.current) {
        setImportSuccess(
          `⏸️ أوقفت الاستيراد بعد معالجة ${currentOffset} من ${finalTarget} فصل.`
        );
        return;
      }

      if (
        !result.chapters ||
        result.chapters.length === 0
      ) {
        setChapterError(
          "لم يتم العثور على دفعة جديدة."
        );
        return;
      }

      setChapters(
        (previous) => [
          ...previous,
          ...result.chapters,
        ]
      );

      const newLoaded = currentOffset + result.chapters.length;

      setLoadedChapters(
        newLoaded
      );

      setCurrentBatch(
        Math.ceil(
          newLoaded / 100
        )
      );

      setLoadingChapters(
        false
      );

      const batchSucceeded = await importBatch(
        result.chapters
      );

      if (!batchSucceeded) {
        return;
      }

      if (stopRequested.current) {
        setImportSuccess(
          `⏸️ أوقفت الاستيراد بعد معالجة ${newLoaded} من ${finalTarget} فصل.`
        );
        return;
      }

      if (
        newLoaded >= finalTarget
      ) {
        setImportSuccess(
          "🎉 اكتمل جلب واستيراد جميع الفصول المطلوبة."
        );

        return;
      }

      setWaitingForNextBatch(
        true
      );

      await continueNextBatch(
        newLoaded,
        finalTarget
      );
    } catch (err) {
      setChapterError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء جلب الدفعة التالية"
      );
    } finally {
      setLoadingChapters(
        false
      );

      setWaiting(false);
      setCountdown(0);
      setWaitingForNextBatch(false);
    }
  }

  function stopImport() {
    stopRequested.current = true;
    setImportSuccess(
      "سيتم إيقاف الاستيراد بعد انتهاء الدفعة الحالية."
    );
  }

  const attributes =
    manga?.data?.attributes;

  const title =
    attributes?.title?.en ||
    Object.values(
      attributes?.title || {}
    )[0] ||
    "بدون عنوان";

  const description =
    attributes?.description?.en ||
    Object.values(
      attributes?.description || {}
    )[0] ||
    "لا يوجد وصف";

  /*
   * استخدام رابط الغلاف الذي يتم
   * تجهيزه داخل lib/mangadex.ts.
   *
   * هذا مهم لأن lib/mangadex.ts
   * يستخدم رابط MangaDex بالحجم 512px.
   */
  const coverUrl =
    manga?.coverUrl ||
    null;

  const progress =
    targetChapters > 0
      ? Math.min(
          100,
          Math.round(
            (loadedChapters /
              targetChapters) *
              100
          )
        )
      : 0;

  const languageName =
    language === "ar"
      ? "العربية"
      : language === "en"
      ? "الإنجليزية"
      : language === "fr"
      ? "الفرنسية"
      : language === "es"
      ? "الإسبانية"
      : language === "ja"
      ? "اليابانية"
      : language
      ? language.toUpperCase()
      : "جاري التحديد...";

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-white px-4 py-10"
    >
      <div className="mx-auto max-w-5xl">

        <h1 className="text-3xl font-bold text-black">
          استيراد من MangaDex
        </h1>

        <p className="mt-2 text-gray-600">
          ابحث عن المانجا ثم استورد فصولها
          وصفحاتها تلقائيًا إلى AL TITIZE.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">

          <label className="mb-2 block text-sm font-bold text-gray-700">
            اسم المانغا
          </label>

          <input
            type="text"
            value={input}
            disabled={
              loading ||
              loadingChapters ||
              importingBatch ||
              waitingForNextBatch
            }
            onChange={(e) =>
              setInput(
                e.target.value
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSearch();
              }
            }}
            placeholder="مثال: Naruto أو ناروتو"
            dir="auto"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-black"
          />

          <p className="mt-2 text-xs leading-6 text-gray-500">
            اكتب الاسم واضغط بحث. يمكنك أيضًا لصق رابط MangaDex أو المعرّف إذا كان لديك.
          </p>

          <button
            onClick={handleSearch}
            disabled={
              loading ||
              loadingChapters ||
              importingBatch ||
              waitingForNextBatch
            }
            className="mt-4 w-full rounded-xl bg-black px-4 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "جاري البحث..."
              : "بحث عن المانغا"}
          </button>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

        </div>

        {searchResults.length > 0 && (
          <section className="mt-8" aria-labelledby="mangadex-results-title">
            <h2
              id="mangadex-results-title"
              className="mb-4 text-xl font-bold text-black"
            >
              اختر المانغا الصحيحة
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => void handleSelectManga(result.id)}
                  disabled={
                    loading ||
                    loadingChapters ||
                    importingBatch ||
                    waitingForNextBatch
                  }
                  className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-right transition hover:border-black hover:shadow-md disabled:cursor-wait disabled:opacity-60"
                >
                  {result.coverUrl ? (
                    <img
                      src={result.coverUrl}
                      alt=""
                      loading="lazy"
                      className="h-28 w-20 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-500">
                      بلا غلاف
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-black">
                      {result.title}
                    </span>
                    {result.alternativeTitles.length > 0 && (
                      <span className="mt-2 line-clamp-2 block text-xs leading-5 text-gray-500">
                        {result.alternativeTitles.slice(0, 3).join(" · ")}
                      </span>
                    )}
                    {result.status && (
                      <span className="mt-2 block text-xs text-gray-500">
                        الحالة: {result.status}
                      </span>
                    )}
                    <span className="mt-3 block text-sm font-bold text-orange-700">
                      {loading ? "جاري تحميل البيانات..." : "اختيار هذه المانغا ←"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {manga && (
          <>

            <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">

              <div className="grid gap-6 p-6 sm:grid-cols-[180px_1fr]">

                <div>
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={String(
                        title
                      )}
                      loading="eager"
                      className="w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500">
                      لا يوجد غلاف
                    </div>
                  )}
                </div>

                <div>

                  <p className="text-xs font-bold text-gray-500">
                    المانجا
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-black">
                    {String(title)}
                  </h2>

                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-600">
                    {String(
                      description
                    )}
                  </p>

                  <div className="mt-5 inline-flex rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600">
                    لغة الفصول المختارة تلقائيًا:{" "}
                    {languageName}
                  </div>

                  {language === "ar" && (
                    <p className="mt-2 text-xs font-bold text-green-600">
                      ✓ تم العثور على فصول عربية
                    </p>
                  )}

                  {language &&
                    language !== "ar" && (
                      <p className="mt-2 text-xs font-bold text-orange-600">
                        لم توجد فصول عربية، تم اختيار اللغة المتوفرة تلقائيًا.
                      </p>
                    )}

                </div>

              </div>

            </div>

            {chapterError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {chapterError}
              </div>
            )}

            {importSuccess && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
                {importSuccess}
              </div>
            )}

            {showChapterSettings &&
              totalChapters > 0 && (
                <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6 text-center">

                  <p className="text-sm font-bold text-green-700">
                    📚 تم العثور على عدد الفصول
                  </p>

                  <p className="mt-2 text-5xl font-black text-green-800">
                    {totalChapters}
                  </p>

                  <p className="mt-2 text-sm text-green-700">
                    فصل متوفر في MangaDex
                  </p>

                </div>
              )}

            {showChapterSettings && (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">

                <h2 className="text-xl font-bold text-black">
                  إعدادات الفصول
                </h2>

                <div className="mt-5">

                  <div>

                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      لغة الفصول
                    </label>

                    <div className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-bold text-gray-700">
                      {languageName}
                    </div>

                    <p className="mt-2 text-xs text-gray-500">
                      تم اختيار اللغة تلقائيًا: العربية أولًا، ثم لغة أخرى عند عدم توفر العربية.
                    </p>

                  </div>

                </div>

                <div className="mt-5">

                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    عدد الفصول
                  </label>

                  <select
                    value={importMode}
                    disabled={
                      loadingChapters ||
                      importingBatch ||
                      waitingForNextBatch
                    }
                    onChange={(e) =>
                      setImportMode(
                        e.target.value as ImportMode
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black disabled:opacity-50"
                  >
                    <option value="number">
                      عدد محدد
                    </option>

                    <option value="all">
                      كل الفصول
                    </option>
                  </select>

                </div>

                {importMode === "number" && (
                  <div className="mt-4">

                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      كم فصل تريد؟
                    </label>

                    <input
                      type="number"
                      min="1"
                      max={
                        totalChapters
                      }
                      value={
                        chapterLimit
                      }
                      disabled={
                        loadingChapters ||
                        importingBatch ||
                        waitingForNextBatch
                      }
                      onChange={(e) =>
                        setChapterLimit(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black disabled:opacity-50"
                    />

                    <p className="mt-2 text-xs text-gray-500">
                      أقصى عدد متوفر:{" "}
                      {totalChapters}
                    </p>

                  </div>
                )}

                <button
                  onClick={
                    startImport
                  }
                  disabled={
                    loadingChapters ||
                    importingBatch ||
                    waitingForNextBatch ||
                    !language ||
                    (importMode ===
                      "number" &&
                      (Number(
                        chapterLimit
                      ) < 1 ||
                        Number(
                          chapterLimit
                        ) >
                          totalChapters))
                  }
                  className="mt-5 w-full rounded-xl bg-black px-4 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingChapters
                    ? "جاري جلب الفصول..."
                    : importingBatch
                    ? "📥 جاري استيراد الفصول تلقائيًا..."
                    : importMode === "all"
                    ? "إضافة كل الفصول والصفحات تلقائيًا"
                    : "إضافة الفصول والصفحات المختارة"}
                </button>

              </div>
            )}

            {(loadingChapters ||
              importingBatch ||
              waitingForNextBatch ||
              loadedChapters > 0) && (
              <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="font-bold text-blue-900">

                      {waiting ? (
                        "⏳ انتظار قبل الطلب التالي"
                      ) : importingBatch ? (
                        "📥 جاري استيراد الفصول والصفحات..."
                      ) : waitingForNextBatch ? (
                        "⏳ انتظار تلقائي قبل الدفعة التالية"
                      ) : loadingChapters ? (
                        "📥 جاري جلب الفصول"
                      ) : loadedChapters >=
                        targetChapters ? (
                        "✅ اكتمل الاستيراد"
                      ) : (
                        "📚 حالة الاستيراد"
                      )}

                    </p>

                    <p className="mt-1 text-sm text-blue-700">

                      تم جلب{" "}

                      <strong>
                        {loadedChapters}
                      </strong>{" "}

                      من{" "}

                      <strong>
                        {targetChapters}
                      </strong>{" "}

                      فصل

                    </p>

                  </div>

                  {waiting && (
                    <div className="text-center">

                      <div className="text-3xl font-black text-blue-900">
                        {countdown}
                      </div>

                      <div className="text-xs text-blue-700">
                        ثوانٍ
                      </div>

                    </div>
                  )}

                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-blue-100">

                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-500"
                    style={{
                      width: `${progress}%`,
                    }}
                  />

                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">

                  <div className="rounded-xl bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">
                      مستورد
                    </p>

                    <p className="mt-1 text-xl font-black text-green-600">
                      {importedCount}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">
                      موجود مسبقًا
                    </p>

                    <p className="mt-1 text-xl font-black text-gray-600">
                      {skippedCount}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">
                      فشل
                    </p>

                    <p className="mt-1 text-xl font-black text-red-600">
                      {failedCount}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">
                      الصفحات الجديدة
                    </p>

                    <p className="mt-1 text-xl font-black text-blue-600">
                      {totalImportedPages}
                    </p>
                  </div>

                </div>

                <p className="mt-4 text-center text-xs text-blue-700">
                  الدفعة الحالية:{" "}
                  {currentBatch || 1}
                  {" · "}
                  الحد الأقصى لكل طلب: 100 فصل
                </p>

                {waitingForNextBatch &&
                  loadedChapters <
                    targetChapters && (
                    <div className="mt-5 rounded-xl border border-blue-300 bg-white p-5 text-center">

                      <p className="text-sm font-bold text-gray-900">
                        سيكمل النظام الاستيراد تلقائيًا بعد الانتظار القصير.
                      </p>

                      <button
                        type="button"
                        onClick={stopImport}
                        className="mt-4 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
                      >
                        أوقف بعد الدفعة الحالية
                      </button>

                    </div>
                  )}

                {!waitingForNextBatch &&
                  (loadingChapters || importingBatch) &&
                  loadedChapters < targetChapters && (
                    <button
                      type="button"
                      onClick={stopImport}
                      className="mt-5 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
                    >
                      أوقف بعد الدفعة الحالية
                    </button>
                  )}

              </div>
            )}

            {chapters.length > 0 && (
              <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5">

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                  <h2 className="text-xl font-bold text-black">
                    الفصول التي تمت معالجتها
                  </h2>

                  <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700">
                    {chapters.length} فصل
                  </span>

                </div>

                <div className="mt-5 space-y-3">

                  {chapters.map(
                    (
                      chapter,
                      index
                    ) => (
                      <div
                        key={
                          chapter.id
                        }
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >

                        <div className="flex flex-col gap-4">

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                            <div>

                              <p className="font-bold text-black">
                                الفصل{" "}
                                {chapter.chapter ||
                                  index +
                                    1}
                              </p>

                              {chapter.title && (
                                <p className="mt-1 text-sm text-gray-600">
                                  {
                                    chapter.title
                                  }
                                </p>
                              )}

                            </div>

                            <div className="text-xs text-gray-500">
                              {chapter.language.toUpperCase()}
                              {" · "}
                              صفحات MangaDex: {chapter.pages}
                            </div>

                          </div>

                          {(() => {
                            const outcome = chapterResults[chapter.id];
                            const message = !outcome
                              ? "سيتم جلب صفحات هذا الفصل تلقائيًا ضمن الدفعة."
                              : !outcome.success
                                ? `فشل استيراد الفصل: ${outcome.error || "لم يتم العثور على صفحات."}`
                                : outcome.skipped
                                  ? "الفصل موجود مسبقًا؛ لم تُرفع صفحات جديدة."
                                  : `تم رفع ${outcome.pages} صفحة عبر ${outcome.source === "consumet" ? "Consumet" : "MangaDex"}.`;
                            const style = !outcome
                              ? "bg-gray-100 text-gray-700"
                              : !outcome.success
                                ? "bg-red-50 text-red-700"
                                : outcome.skipped
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-green-50 text-green-700";

                            return (
                              <div className={`rounded-lg px-4 py-3 text-center text-sm font-bold ${style}`}>
                                {message}
                              </div>
                            );
                          })()}

                        </div>

                      </div>
                    )
                  )}

                </div>

              </div>
            )}

          </>
        )}

      </div>
    </main>
  );
}
