"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getChapterInfo,
  getChapterPages,
  getMangaInfo,
} from "@/lib/mangadex";

type ChapterToImport = {
  id: string;
  chapter: string | null;
  title: string;
  language: string;
  pages: number;
  volume: string | null;
};

type ImportChapterResult = {
  success: boolean;
  chapterId?: number;
  chapterNumber?: number;
  pages?: number;
  skipped?: boolean;
  error?: string;
  message?: string;
  downloadedBytes?: number;
  uploadedBytes?: number;
};

export type BatchImportResult = {
  success: boolean;
  mangaId?: number;
  imported: number;
  skipped: number;
  failed: number;
  totalPages: number;
  downloadedBytes: number;
  uploadedBytes: number;
  totalBytes: number;

  results: {
    chapterId: string;
    chapterNumber: number | null;
    pages: number;
    success: boolean;
    skipped: boolean;
    error?: string;
    downloadedBytes?: number;
    uploadedBytes?: number;
  }[];

  error?: string;
};

/*
 * ================================
 * إعدادات الاستيراد
 * ================================
 */

const PAGE_CONCURRENCY = 4;
const PAGE_RETRIES = 3;
const PAGE_TIMEOUT_MS = 30_000;

/*
 * ================================
 * أدوات عامة
 * ================================
 */

function bytesToMB(bytes: number) {
  return bytes / 1024 / 1024;
}

function bytesToGB(bytes: number) {
  return bytes / 1024 / 1024 / 1024;
}

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function formatBytes(bytes: number) {
  if (!bytes) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${bytesToMB(bytes).toFixed(2)} MB`;
  }

  return `${bytesToGB(bytes).toFixed(2)} GB`;
}

function logSection(title: string) {
  console.log(
    "=============================================="
  );

  console.log(
    `[AL TITIZE IMPORT] ${title}`
  );

  console.log(
    "=============================================="
  );
}

function logInfo(
  message: string,
  value?: unknown
) {
  if (typeof value === "undefined") {
    console.log(
      `[AL TITIZE IMPORT] ${message}`
    );
    return;
  }

  console.log(
    `[AL TITIZE IMPORT] ${message}`,
    value
  );
}

function logSuccess(
  message: string
) {
  console.log(
    `[AL TITIZE IMPORT] ✅ ${message}`
  );
}

function logWarning(
  message: string
) {
  console.log(
    `[AL TITIZE IMPORT] ⚠️ ${message}`
  );
}

function logError(
  message: string,
  error?: unknown
) {
  if (
    typeof error === "undefined"
  ) {
    console.error(
      `[AL TITIZE IMPORT] ❌ ${message}`
    );
    return;
  }

  console.error(
    `[AL TITIZE IMPORT] ❌ ${message}`,
    error
  );
}

/*
 * ================================
 * تحميل صفحة واحدة مع Retry
 * ================================
 */

async function downloadPageWithRetry(
  url: string,
  pageNumber: number,
  totalPages: number
) {
  let lastError =
    "فشل تحميل الصفحة.";

  for (
    let attempt = 1;
    attempt <= PAGE_RETRIES;
    attempt++
  ) {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => {
        controller.abort();
      },
      PAGE_TIMEOUT_MS
    );

    try {
      logInfo(
        `تحميل الصفحة ${pageNumber}/${totalPages} — محاولة ${attempt}/${PAGE_RETRIES}`
      );

      const response =
        await fetch(url, {
          cache: "no-store",
          signal:
            controller.signal,
        });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      clearTimeout(timeout);

      if (
        !arrayBuffer.byteLength
      ) {
        throw new Error(
          `الصفحة ${pageNumber} فارغة.`
        );
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) ||
        "image/jpeg";

      logSuccess(
        `تم تحميل الصفحة ${pageNumber}/${totalPages} — ${formatBytes(
          arrayBuffer.byteLength
        )}`
      );

      return {
        arrayBuffer,
        contentType,
        bytes: arrayBuffer.byteLength,
      };
    } catch (error) {
      clearTimeout(timeout);

      lastError =
        error instanceof Error
          ? error.name ===
            "AbortError"
            ? `انتهت مهلة تحميل الصفحة ${pageNumber}.`
            : error.message
          : `فشل تحميل الصفحة ${pageNumber}.`;

      logWarning(
        `فشل تحميل الصفحة ${pageNumber}: ${lastError}`
      );

      if (
        attempt < PAGE_RETRIES
      ) {
        const retryDelay =
          attempt * 1000;

        logInfo(
          `إعادة المحاولة بعد ${retryDelay /
            1000} ثانية`
        );

        await sleep(
          retryDelay
        );
      }
    }
  }

  throw new Error(
    `فشل تحميل الصفحة ${pageNumber} بعد ${PAGE_RETRIES} محاولات: ${lastError}`
  );
}

/*
 * ================================
 * التحقق من ترتيب الصفحات
 * ================================
 */

function validatePageOrder(
  pageRows: {
    chapter_id: number;
    page_number: number;
    image_url: string;
  }[],
  expectedPageCount: number
) {
  if (
    pageRows.length !==
    expectedPageCount
  ) {
    throw new Error(
      `عدد الصفحات غير صحيح: تم تجهيز ${pageRows.length} من أصل ${expectedPageCount}.`
    );
  }

  for (
    let i = 0;
    i < pageRows.length;
    i++
  ) {
    const expectedNumber =
      i + 1;

    const actualNumber =
      pageRows[i]
        .page_number;

    if (
      actualNumber !==
      expectedNumber
    ) {
      throw new Error(
        `ترتيب الصفحات غير صحيح عند الصفحة ${expectedNumber}. تم العثور على ${actualNumber}.`
      );
    }
  }

  const pageNumbers =
    new Set(
      pageRows.map(
        (page) =>
          page.page_number
      )
    );

  if (
    pageNumbers.size !==
    expectedPageCount
  ) {
    throw new Error(
      "تم العثور على صفحات مكررة."
    );
  }

  logSuccess(
    `تم التأكد من ترتيب ${expectedPageCount} صفحة: 1 → ${expectedPageCount}`
  );
}

/*
 * ================================
 * التحقق من الأدمن
 * ================================
 */

async function checkAdmin() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      error:
        "يجب تسجيل الدخول أولاً.",
    };
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    return {
      supabase,
      user,
      error:
        "تعذر التحقق من صلاحيات المستخدم.",
    };
  }

  if (
    profile?.role !==
    "admin"
  ) {
    return {
      supabase,
      user,
      error:
        "ليس لديك صلاحية استيراد الفصول.",
    };
  }

  return {
    supabase,
    user,
    error: null,
  };
}

/*
 * ================================
 * إنشاء / البحث عن المانجا
 * ================================
 */

async function ensureMangaExists(
  supabase: any,
  mangaDexId: string
) {
  logSection(
    "التحقق من المانجا"
  );

  logInfo(
    "MangaDex ID:",
    mangaDexId
  );

  const {
    data: existingManga,
    error: existingError,
  } =
    await supabase
      .from("manga")
      .select(
        "id, title, description, cover_url, status, mangadex_id"
      )
      .eq(
        "mangadex_id",
        mangaDexId
      )
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `فشل البحث عن المانجا: ${existingError.message}`
    );
  }

  logSuccess(
    existingManga
      ? `تم العثور على المانجا: ${existingManga.title}`
      : "المانجا غير موجودة في AL TITIZE."
  );

  /*
   * جلب بيانات MangaDex
   */
  logInfo(
    "جلب معلومات MangaDex والغلاف..."
  );

  const mangaInfo =
    await getMangaInfo(
      mangaDexId
    );

  if (!mangaInfo) {
    throw new Error(
      "تعذر الحصول على معلومات المانجا من MangaDex."
    );
  }

  const officialCoverUrl =
    mangaInfo.coverUrl ||
    null;

  logInfo(
    "رابط الغلاف القادم من MangaDex:",
    officialCoverUrl
  );

  /*
   * مانجا موجودة
   */
  if (existingManga) {
    if (
      officialCoverUrl &&
      existingManga.cover_url !==
        officialCoverUrl
    ) {
      logInfo(
        "تحديث cover_url..."
      );

      const {
        data: updatedManga,
        error: updateError,
      } =
        await supabase
          .from("manga")
          .update({
            cover_url:
              officialCoverUrl,
          })
          .eq(
            "id",
            existingManga.id
          )
          .select(
            "id, title, description, cover_url, status, mangadex_id"
          )
          .single();

      if (updateError) {
        throw new Error(
          `فشل تحديث غلاف المانجا: ${updateError.message}`
        );
      }

      logSuccess(
        "تم تحديث غلاف المانجا."
      );

      return updatedManga;
    }

    logSuccess(
      "الغلاف الموجود مطابق للغلاف الحالي."
    );

    return existingManga;
  }

  /*
   * إنشاء مانجا جديدة
   */

  logInfo(
    "إنشاء المانجا داخل AL TITIZE..."
  );

  const attributes =
    mangaInfo?.data
      ?.attributes || {};

  const title =
    attributes?.title?.en ||
    Object.values(
      attributes?.title || {}
    )[0] ||
    "بدون عنوان";

  const description =
    attributes?.description?.en ||
    Object.values(
      attributes?.description ||
        {}
    )[0] ||
    "";

  const {
    data: newManga,
    error: insertError,
  } =
    await supabase
      .from("manga")
      .insert({
        title: String(title),
        description:
          String(
            description
          ),
        cover_url:
          officialCoverUrl,
        status: "ongoing",
        mangadex_id:
          mangaDexId,
      })
      .select(
        "id, title, description, cover_url, status, mangadex_id"
      )
      .single();

  if (
    insertError ||
    !newManga
  ) {
    throw new Error(
      insertError?.message ||
        "فشل إنشاء المانجا في AL TITIZE."
    );
  }

  logSuccess(
    `تم إنشاء المانجا: ${newManga.title}`
  );

  logInfo(
    "الغلاف المحفوظ:",
    newManga.cover_url
  );

  return newManga;
}

/*
 * ================================
 * استيراد فصل واحد
 * ================================
 */

async function importOneChapter(
  supabase: any,
  manga: any,
  chapterDexId: string
): Promise<ImportChapterResult> {
  let createdChapterId:
    | number
    | null = null;

  const uploadedFilePaths:
    string[] = [];

  let downloadedBytes = 0;
  let uploadedBytes = 0;

  try {
    logSection(
      `بدء استيراد الفصل ${chapterDexId}`
    );

    /*
     * معلومات الفصل
     */

    logInfo(
      "جلب معلومات الفصل..."
    );

    const chapter =
      await getChapterInfo(
        chapterDexId
      );

    const chapterNumber =
      Number(chapter.chapter);

    logInfo(
      "رقم الفصل:",
      chapterNumber
    );

    if (
      !Number.isInteger(
        chapterNumber
      )
    ) {
      throw new Error(
        `رقم الفصل "${chapter.chapter}" غير صالح.`
      );
    }

    /*
     * التحقق من الفصل الموجود
     */

    logInfo(
      `البحث عن الفصل ${chapterNumber} في قاعدة البيانات...`
    );

    const {
      data: existingChapter,
      error:
        existingChapterError,
    } =
      await supabase
        .from("chapters")
        .select("id")
        .eq(
          "manga_id",
          manga.id
        )
        .eq(
          "chapter_number",
          chapterNumber
        )
        .maybeSingle();

    if (
      existingChapterError
    ) {
      throw new Error(
        `فشل التحقق من الفصل: ${existingChapterError.message}`
      );
    }

    if (existingChapter) {
      logWarning(
        `الفصل ${chapterNumber} موجود بالفعل — سيتم تخطيه.`
      );

      return {
        success: true,
        skipped: true,
        chapterNumber,
        pages: 0,
        downloadedBytes: 0,
        uploadedBytes: 0,
        message:
          `الفصل ${chapterNumber} موجود بالفعل.`,
      };
    }

    /*
     * جلب صفحات الفصل
     */

    logInfo(
      "جلب قائمة صفحات الفصل من MangaDex..."
    );

    const rawPages =
      await getChapterPages(
        chapterDexId
      );

    if (
      !rawPages.length
    ) {
      throw new Error(
        "لم يتم العثور على صفحات لهذا الفصل."
      );
    }

    logSuccess(
      `تم العثور على ${rawPages.length} صفحة.`
    );

    /*
     * ترتيب المصدر
     */

    const pages =
      [...rawPages].sort(
        (a, b) =>
          a.page_number -
          b.page_number
      );

    /*
     * التحقق من المصدر
     */

    for (
      let i = 0;
      i < pages.length;
      i++
    ) {
      const expected =
        i + 1;

      if (
        pages[i].page_number !==
        expected
      ) {
        throw new Error(
          `قائمة صفحات MangaDex غير مرتبة أو تحتوي على صفحة مفقودة عند الرقم ${expected}.`
        );
      }
    }

    logSuccess(
      `تم تثبيت ترتيب المصدر: 1 → ${pages.length}`
    );

    /*
     * إنشاء الفصل
     */

    logInfo(
      "إنشاء سجل الفصل..."
    );

    const {
      data: newChapter,
      error: chapterError,
    } =
      await supabase
        .from("chapters")
        .insert({
          manga_id:
            manga.id,
          chapter_number:
            chapterNumber,
          title:
            chapter.title ||
            `Chapter ${chapterNumber}`,
        })
        .select("id")
        .single();

    if (
      chapterError ||
      !newChapter
    ) {
      throw new Error(
        chapterError?.message ||
          "فشل إنشاء الفصل."
      );
    }

    createdChapterId =
      newChapter.id;

    logSuccess(
      `تم إنشاء الفصل في قاعدة البيانات: ${newChapter.id}`
    );

    /*
     * تجهيز الصفحات
     */

    const pageRows: {
      chapter_id: number;
      page_number: number;
      image_url: string;
    }[] = [];

    for (
      let i = 0;
      i < pages.length;
      i += PAGE_CONCURRENCY
    ) {
      const currentPages =
        pages.slice(
          i,
          i +
            PAGE_CONCURRENCY
        );

      const startPage =
        i + 1;

      const endPage =
        Math.min(
          i +
            PAGE_CONCURRENCY,
          pages.length
        );

      logInfo(
        `بدء دفعة الصفحات ${startPage}-${endPage}/${pages.length}`
      );

      const batchResults =
        await Promise.all(
          currentPages.map(
            async (page) => {
              const downloaded =
                await downloadPageWithRetry(
                  page.image_url,
                  page.page_number,
                  pages.length
                );

              downloadedBytes +=
                downloaded.bytes;

              const extension =
                downloaded.contentType.includes(
                  "png"
                )
                  ? "png"
                  : downloaded.contentType.includes(
                      "webp"
                    )
                  ? "webp"
                  : "jpg";

              const filePath =
                `chapters/${newChapter.id}/page-${page.page_number}.${extension}`;

              logInfo(
                `رفع الصفحة ${page.page_number}/${pages.length} إلى Supabase Storage...`
              );

              const {
                error:
                  uploadError,
              } =
                await supabase.storage
                  .from(
                    "manga-pages"
                  )
                  .upload(
                    filePath,
                    downloaded.arrayBuffer,
                    {
                      contentType:
                        downloaded.contentType,
                      upsert: true,
                    }
                  );

              if (
                uploadError
              ) {
                throw new Error(
                  `فشل رفع الصفحة ${page.page_number}: ${uploadError.message}`
                );
              }

              uploadedBytes +=
                downloaded.bytes;

              uploadedFilePaths.push(
                filePath
              );

              const {
                data:
                  publicUrlData,
              } =
                supabase.storage
                  .from(
                    "manga-pages"
                  )
                  .getPublicUrl(
                    filePath
                  );

              logSuccess(
                `الصفحة ${page.page_number}/${pages.length} مكتملة`
              );

              return {
                chapter_id:
                  newChapter.id,
                page_number:
                  page.page_number,
                image_url:
                  publicUrlData.publicUrl,
              };
            }
          )
        );

      pageRows.push(
        ...batchResults
      );

      const processed =
        Math.min(
          i +
            PAGE_CONCURRENCY,
          pages.length
        );

      logInfo(
        `تقدم الفصل: ${processed}/${pages.length} صفحة`
      );

      logInfo(
        `إجمالي التحميل: ${formatBytes(
          downloadedBytes
        )}`
      );

      logInfo(
        `إجمالي الرفع: ${formatBytes(
          uploadedBytes
        )}`
      );
    }

    /*
     * التحقق النهائي
     */

    logInfo(
      "التحقق النهائي من ترتيب الصفحات..."
    );

    pageRows.sort(
      (a, b) =>
        a.page_number -
        b.page_number
    );

    validatePageOrder(
      pageRows,
      pages.length
    );

    for (
      const pageRow of pageRows
    ) {
      if (
        pageRow.chapter_id !==
        newChapter.id
      ) {
        throw new Error(
          `تم اكتشاف صفحة لا تنتمي إلى الفصل ${newChapter.id}.`
        );
      }
    }

    /*
     * حفظ الصفحات
     */

    logInfo(
      `حفظ ${pageRows.length} صفحة في قاعدة البيانات...`
    );

    const {
      error: pagesError,
    } =
      await supabase
        .from("pages")
        .insert(
          pageRows
        );

    if (pagesError) {
      throw new Error(
        `فشل حفظ صفحات الفصل: ${pagesError.message}`
      );
    }

    logSuccess(
      `تم حفظ ${pageRows.length} صفحة بالترتيب الصحيح.`
    );

    const totalBytes =
      downloadedBytes +
      uploadedBytes;

    logSection(
      `اكتمل الفصل ${chapterNumber}`
    );

    logInfo(
      "الصفحات:",
      pageRows.length
    );

    logInfo(
      "التحميل:",
      formatBytes(
        downloadedBytes
      )
    );

    logInfo(
      "الرفع:",
      formatBytes(
        uploadedBytes
      )
    );

    logInfo(
      "إجمالي حركة البيانات:",
      formatBytes(
        totalBytes
      )
    );

    return {
      success: true,
      skipped: false,
      chapterId:
        newChapter.id,
      chapterNumber,
      pages:
        pageRows.length,
      downloadedBytes,
      uploadedBytes,
      message:
        `تم استيراد الفصل ${chapterNumber} بنجاح.`,
    };
  } catch (error) {
    logError(
      `فشل استيراد الفصل ${chapterDexId}`,
      error
    );

    /*
     * تنظيف Storage
     */

    if (
      uploadedFilePaths.length
    ) {
      logInfo(
        `تنظيف ${uploadedFilePaths.length} ملف من Storage...`
      );

      const {
        error:
          storageDeleteError,
      } =
        await supabase.storage
          .from(
            "manga-pages"
          )
          .remove(
            uploadedFilePaths
          );

      if (
        storageDeleteError
      ) {
        logWarning(
          `فشل تنظيف بعض الملفات: ${storageDeleteError.message}`
        );
      } else {
        logSuccess(
          "تم تنظيف ملفات Storage."
        );
      }
    }

    /*
     * تنظيف الفصل
     */

    if (createdChapterId) {
      logInfo(
        `حذف الفصل الناقص: ${createdChapterId}`
      );

      const {
        error:
          deleteChapterError,
      } =
        await supabase
          .from("chapters")
          .delete()
          .eq(
            "id",
            createdChapterId
          );

      if (
        deleteChapterError
      ) {
        logWarning(
          `تعذر حذف الفصل الناقص: ${deleteChapterError.message}`
        );
      } else {
        logSuccess(
          "تم حذف الفصل الناقص."
        );
      }
    }

    return {
      success: false,
      skipped: false,
      pages: 0,
      downloadedBytes,
      uploadedBytes,
      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء استيراد الفصل.",
    };
  }
}

/*
 * ================================
 * استيراد فصل واحد
 * ================================
 */

export async function importChapterAction(
  mangaDexId: string,
  chapterDexId: string
) {
  logSection(
    "استيراد فصل واحد يدويًا"
  );

  const {
    supabase,
    error: authError,
  } =
    await checkAdmin();

  if (authError) {
    return {
      success: false,
      error: authError,
    };
  }

  try {
    const manga =
      await ensureMangaExists(
        supabase,
        mangaDexId
      );

    return await importOneChapter(
      supabase,
      manga,
      chapterDexId
    );
  } catch (error) {
    logError(
      "فشل الاستيراد اليدوي",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء استيراد الفصل.",
    };
  }
}

/*
 * ================================
 * استيراد دفعة كاملة
 * ================================
 */

export async function importChaptersBatchAction(
  mangaDexId: string,
  chapters: ChapterToImport[]
): Promise<BatchImportResult> {
  logSection(
    "بدء استيراد دفعة"
  );

  logInfo(
    "MangaDex ID:",
    mangaDexId
  );

  logInfo(
    "عدد الفصول:",
    chapters.length
  );

  const {
    supabase,
    error: authError,
  } =
    await checkAdmin();

  if (authError) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      totalPages: 0,
      downloadedBytes: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      results: [],
      error: authError,
    };
  }

  if (!chapters.length) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      totalPages: 0,
      downloadedBytes: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      results: [],
      error:
        "لم يتم إرسال أي فصول للاستيراد.",
    };
  }

  if (
    chapters.length > 100
  ) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      totalPages: 0,
      downloadedBytes: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      results: [],
      error:
        "الحد الأقصى للدفعة الواحدة هو 100 فصل.",
    };
  }

  try {
    const manga =
      await ensureMangaExists(
        supabase,
        mangaDexId
      );

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let totalPages = 0;

    let totalDownloadedBytes =
      0;

    let totalUploadedBytes =
      0;

    const results: BatchImportResult["results"] =
      [];

    for (
      let index = 0;
      index < chapters.length;
      index++
    ) {
      const chapter =
        chapters[index];

      logSection(
        `الفصل ${index + 1}/${chapters.length}`
      );

      logInfo(
        "Chapter ID:",
        chapter.id
      );

      logInfo(
        "رقم الفصل:",
        chapter.chapter
      );

      const result =
        await importOneChapter(
          supabase,
          manga,
          chapter.id
        );

      totalDownloadedBytes +=
        result.downloadedBytes ||
        0;

      totalUploadedBytes +=
        result.uploadedBytes ||
        0;

      if (result.success) {
        if (result.skipped) {
          skipped++;
        } else {
          imported++;

          totalPages +=
            result.pages || 0;
        }
      } else {
        failed++;
      }

      results.push({
        chapterId:
          chapter.id,

        chapterNumber:
          result.chapterNumber ??
          (chapter.chapter
            ? Number(
                chapter.chapter
              )
            : null),

        pages:
          result.pages || 0,

        success:
          result.success,

        skipped:
          result.skipped ||
          false,

        error:
          result.error,

        downloadedBytes:
          result.downloadedBytes ||
          0,

        uploadedBytes:
          result.uploadedBytes ||
          0,
      });

      logInfo(
        "إحصائيات الدفعة الحالية:"
      );

      logInfo(
        `تمت المعالجة: ${index + 1}/${chapters.length}`
      );

      logInfo(
        `مستورد: ${imported}`
      );

      logInfo(
        `موجود مسبقًا: ${skipped}`
      );

      logInfo(
        `فشل: ${failed}`
      );

      logInfo(
        `الصفحات الجديدة: ${totalPages}`
      );

      logInfo(
        `إجمالي التحميل: ${formatBytes(
          totalDownloadedBytes
        )}`
      );

      logInfo(
        `إجمالي الرفع: ${formatBytes(
          totalUploadedBytes
        )}`
      );

      logInfo(
        `إجمالي حركة البيانات: ${formatBytes(
          totalDownloadedBytes +
            totalUploadedBytes
        )}`
      );
    }

    const totalBytes =
      totalDownloadedBytes +
      totalUploadedBytes;

    logSection(
      "انتهت الدفعة"
    );

    logInfo(
      `المستورد: ${imported}`
    );

    logInfo(
      `الموجود مسبقًا: ${skipped}`
    );

    logInfo(
      `الفاشل: ${failed}`
    );

    logInfo(
      `إجمالي الصفحات: ${totalPages}`
    );

    logInfo(
      "إجمالي التحميل:",
      formatBytes(
        totalDownloadedBytes
      )
    );

    logInfo(
      "إجمالي الرفع:",
      formatBytes(
        totalUploadedBytes
      )
    );

    logInfo(
      "إجمالي حركة البيانات:",
      formatBytes(
        totalBytes
      )
    );

    logInfo(
      "إجمالي حركة البيانات بالـ GB:",
      `${bytesToGB(
        totalBytes
      ).toFixed(2)} GB`
    );

    /*
     * مهم:
     * success = true فقط عندما لا توجد
     * فصول فاشلة.
     */

    return {
      success:
        failed === 0,

      mangaId:
        manga.id,

      imported,

      skipped,

      failed,

      totalPages,

      downloadedBytes:
        totalDownloadedBytes,

      uploadedBytes:
        totalUploadedBytes,

      totalBytes,

      results,

      error:
        failed > 0
          ? `تم استيراد ${imported} فصل، وتخطي ${skipped} فصل، وفشل ${failed} فصل.`
          : undefined,
    };
  } catch (error) {
    logError(
      "فشل استيراد الدفعة بالكامل",
      error
    );

    return {
      success: false,

      imported: 0,

      skipped: 0,

      failed:
        chapters.length,

      totalPages: 0,

      downloadedBytes: 0,

      uploadedBytes: 0,

      totalBytes: 0,

      results: [],

      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء استيراد الدفعة.",
    };
  }
}