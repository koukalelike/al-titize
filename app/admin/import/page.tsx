"use client";

import { useState } from "react";
import {
  getMangaInfo,
  getMangaChapters,
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

export default function MangaDexImportPage() {
  const [input, setInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingChapters, setLoadingChapters] =
    useState(false);
  const [importingBatch, setImportingBatch] =
    useState(false);

  const [error, setError] = useState("");
  const [chapterError, setChapterError] =
    useState("");

  const [manga, setManga] = useState<any>(null);
  const [chapters, setChapters] = useState<Chapter[]>(
    []
  );

  const [language, setLanguage] = useState("ar");

  const [importMode, setImportMode] =
    useState<ImportMode>("number");

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
    setChapters([]);

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

    if (!input.trim()) {
      setError("ضع رابط MangaDex أولاً");
      return;
    }

    try {
      setLoading(true);

      const result = await getMangaInfo(input);

      setManga(result);
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
      setCountdown(seconds);
      await sleep(1000);
    }

    setCountdown(0);
    setWaiting(false);
  }

  async function handleGetChapters() {
    if (!manga?.id) {
      setChapterError(
        "ابحث عن المانجا أولاً"
      );
      return;
    }

    setChapterError("");
    setImportSuccess("");

    try {
      setLoadingChapters(true);

      const result = await getMangaChapters(
        manga.id,
        language,
        1,
        0
      );

      const realTotal = Number(
        result.total || 0
      );

      if (realTotal <= 0) {
        setChapterError(
          "لم يتم العثور على فصول لهذه المانجا بهذه اللغة."
        );

        setShowChapterSettings(false);
        return;
      }

      setTotalChapters(realTotal);
      setShowChapterSettings(true);
    } catch (err) {
      setChapterError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء معرفة عدد الفصول"
      );
    } finally {
      setLoadingChapters(false);
    }
  }

  async function importBatch(
    batchChapters: Chapter[]
  ) {
    if (!manga?.id) {
      setChapterError(
        "بيانات المانجا غير موجودة."
      );
      return;
    }

    if (!batchChapters.length) {
      setChapterError(
        "لا توجد فصول في هذه الدفعة."
      );
      return;
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

      if (!result.success && result.failed > 0) {
        setFailedCount(
          (previous) =>
            previous + result.failed
        );
      }

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
        setChapterError(result.error);
      }

      if (
        result.imported > 0 ||
        result.skipped > 0
      ) {
        setImportSuccess(
          `تمت معالجة الدفعة: ${result.imported} فصل مستورد، ${result.skipped} فصل موجود مسبقًا، ${result.failed} فصل فشل. إجمالي الصفحات الجديدة: ${result.totalPages}`
        );
      }
    } catch (err) {
      setChapterError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء استيراد الدفعة."
      );
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

    setChapterError("");
    setImportSuccess("");
    setWaitingForNextBatch(false);

    setChapters([]);

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

    setTargetChapters(finalTarget);

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

      if (
        !result.chapters ||
        result.chapters.length === 0
      ) {
        setChapterError(
          "لم يتم العثور على فصول."
        );
        return;
      }

      setChapters(result.chapters);

      const loaded =
        result.chapters.length;

      setLoadedChapters(loaded);
      setCurrentBatch(1);

      setLoadingChapters(false);

      // استيراد الدفعة تلقائيًا
      await importBatch(
        result.chapters
      );

      if (loaded >= finalTarget) {
        setImportSuccess(
          "🎉 اكتمل جلب واستيراد جميع الفصول المطلوبة."
        );

        return;
      }

      setWaitingForNextBatch(true);
    } catch (err) {
      setChapterError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء جلب الفصول"
      );

      setLoadingChapters(false);
    }
  }

  async function continueNextBatch() {
    if (!manga?.id) {
      return;
    }

    if (
      loadedChapters >= targetChapters
    ) {
      setWaitingForNextBatch(false);
      return;
    }

    setChapterError("");
    setImportSuccess("");
    setWaitingForNextBatch(false);

    try {
      await waitTenSeconds();

      setLoadingChapters(true);

      const remaining =
        targetChapters - loadedChapters;

      const batchSize = Math.min(
        100,
        remaining
      );

      const result =
        await getMangaChapters(
          manga.id,
          language,
          batchSize,
          loadedChapters
        );

      if (
        !result.chapters ||
        result.chapters.length === 0
      ) {
        setChapterError(
          "لم يتم العثور على دفعة جديدة."
        );
        return;
      }

      setChapters((previous) => [
        ...previous,
        ...result.chapters,
      ]);

      const newLoaded =
        loadedChapters +
        result.chapters.length;

      setLoadedChapters(newLoaded);

      setCurrentBatch(
        Math.ceil(newLoaded / 100)
      );

      setLoadingChapters(false);

      // استيراد الدفعة تلقائيًا
      await importBatch(
        result.chapters
      );

      if (newLoaded >= targetChapters) {
        setImportSuccess(
          "🎉 اكتمل جلب واستيراد جميع الفصول المطلوبة."
        );

        return;
      }

      setWaitingForNextBatch(true);
    } catch (err) {
      setChapterError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء جلب الدفعة التالية"
      );
    } finally {
      setLoadingChapters(false);
      setWaiting(false);
      setCountdown(0);
    }
  }

  function stopImport() {
    setWaitingForNextBatch(false);

    setImportSuccess(
      `⏸️ تم إيقاف الاستيراد بعد معالجة ${loadedChapters} من ${targetChapters} فصل.`
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

  const coverFile =
    manga?.data?.relationships?.find(
      (item: any) =>
        item.type === "cover_art"
    )?.attributes?.fileName;

  const coverUrl = coverFile
    ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFile}`
    : null;

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
      : "اليابانية";

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

        {/* البحث عن المانجا */}

        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">

          <label className="mb-2 block text-sm font-bold text-gray-700">
            رابط MangaDex
          </label>

          <input
            type="text"
            value={input}
            onChange={(e) =>
              setInput(e.target.value)
            }
            placeholder="https://mangadex.org/title/..."
            dir="ltr"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-black"
          />

          <button
            onClick={handleSearch}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-black px-4 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "جاري البحث..."
              : "بحث عن المانجا"}
          </button>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

        </div>

        {/* معلومات المانجا */}

        {manga && (
          <>

            <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">

              <div className="grid gap-6 p-6 sm:grid-cols-[180px_1fr]">

                <div>
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={String(title)}
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
                    {String(description)}
                  </p>

                  <div className="mt-5 inline-flex rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600">
                    لغة الفصول:{" "}
                    {languageName}
                  </div>

                </div>

              </div>

              {/* زر جلب الفصول */}

              <div className="border-t border-gray-200 bg-gray-50 p-5">

                <button
                  onClick={handleGetChapters}
                  disabled={
                    loadingChapters ||
                    importingBatch
                  }
                  className="w-full rounded-xl bg-black px-4 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingChapters
                    ? "جاري البحث عن الفصول..."
                    : "جلب الفصول"}
                </button>

              </div>

            </div>

            {/* الخطأ */}

            {chapterError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {chapterError}
              </div>
            )}

            {/* نجاح الاستيراد */}

            {importSuccess && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
                {importSuccess}
              </div>
            )}

            {/* عدد الفصول الحقيقي */}

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

            {/* إعدادات الفصول */}

            {showChapterSettings && (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">

                <h2 className="text-xl font-bold text-black">
                  إعدادات الفصول
                </h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">

                  <div>

                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      لغة الفصول
                    </label>

                    <select
                      value={language}
                      disabled={
                        loadingChapters ||
                        importingBatch
                      }
                      onChange={(e) =>
                        setLanguage(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black disabled:opacity-50"
                    >
                      <option value="ar">
                        العربية
                      </option>

                      <option value="en">
                        الإنجليزية
                      </option>

                      <option value="fr">
                        الفرنسية
                      </option>

                      <option value="es">
                        الإسبانية
                      </option>

                      <option value="ja">
                        اليابانية
                      </option>
                    </select>

                  </div>

                  <div>

                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      عدد الفصول
                    </label>

                    <select
                      value={importMode}
                      disabled={
                        loadingChapters ||
                        importingBatch
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

                </div>

                {importMode === "number" && (
                  <div className="mt-4">

                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      كم فصل تريد؟
                    </label>

                    <input
                      type="number"
                      min="1"
                      max={totalChapters}
                      value={chapterLimit}
                      disabled={
                        loadingChapters ||
                        importingBatch
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
                  onClick={startImport}
                  disabled={
                    loadingChapters ||
                    importingBatch ||
                    (importMode === "number" &&
                      (Number(chapterLimit) < 1 ||
                        Number(chapterLimit) >
                          totalChapters))
                  }
                  className="mt-5 w-full rounded-xl bg-black px-4 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingChapters
                    ? "جاري جلب الفصول..."
                    : importingBatch
                    ? "📥 جاري استيراد الفصول تلقائيًا..."
                    : "جلب واستيراد هذه الفصول"}
                </button>

              </div>
            )}

            {/* حالة الجلب والاستيراد */}

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
                        "⏸️ في انتظار قرارك"
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

                {/* قرار الدفعة التالية */}

                {waitingForNextBatch &&
                  loadedChapters <
                    targetChapters && (
                    <div className="mt-5 rounded-xl border border-blue-300 bg-white p-5 text-center">

                      <p className="text-lg font-black text-gray-900">
                        تم جلب واستيراد{" "}
                        {loadedChapters}{" "}
                        من{" "}
                        {targetChapters}
                      </p>

                      <p className="mt-2 text-sm text-gray-600">
                        هل تريد جلب واستيراد الدفعة التالية؟
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        عند المتابعة سيتم الانتظار 10 ثوانٍ قبل الطلب التالي.
                      </p>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">

                        <button
                          type="button"
                          onClick={
                            continueNextBatch
                          }
                          disabled={
                            waiting ||
                            loadingChapters ||
                            importingBatch
                          }
                          className="w-full rounded-xl bg-black px-4 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          نعم، تابع
                        </button>

                        <button
                          type="button"
                          onClick={stopImport}
                          disabled={
                            waiting ||
                            loadingChapters ||
                            importingBatch
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          لا، توقف
                        </button>

                      </div>

                    </div>
                  )}

              </div>
            )}

            {/* قائمة الفصول */}

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
                    (chapter, index) => (
                      <div
                        key={chapter.id}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >

                        <div className="flex flex-col gap-4">

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                            <div>

                              <p className="font-bold text-black">
                                الفصل{" "}
                                {chapter.chapter ||
                                  index + 1}
                              </p>

                              {chapter.title && (
                                <p className="mt-1 text-sm text-gray-600">
                                  {chapter.title}
                                </p>
                              )}

                            </div>

                            <div className="text-xs text-gray-500">
                              {chapter.language.toUpperCase()}
                              {" · "}
                              {chapter.pages} صفحة
                            </div>

                          </div>

                          <div className="rounded-lg bg-green-50 px-4 py-3 text-center text-sm font-bold text-green-700">
                            📥 تتم معالجة هذا الفصل تلقائيًا ضمن الدفعة
                          </div>

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