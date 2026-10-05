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

type BatchImportResult = {
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
 * إعدادات الأداء
 *
 * صفحتان فقط في نفس الوقت.
 * هذا يعطي استقرارًا أفضل أثناء التحميل والرفع.
 */
const PAGE_CONCURRENCY = 2;

/*
 * عدد محاولات تحميل الصفحة.
 */
const PAGE_RETRIES = 3;

/*
 * مهلة تحميل الصفحة.
 */
const PAGE_TIMEOUT_MS = 30_000;

/*
 * تحويل Bytes إلى MB.
 */
function bytesToMB(bytes: number) {
  return bytes / 1024 / 1024;
}

/*
 * تحويل Bytes إلى GB.
 */
function bytesToGB(bytes: number) {
  return bytes / 1024 / 1024 / 1024;
}

/*
 * تأخير بسيط.
 */
function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

/*
 * تحميل صفحة مع:
 *
 * - Timeout
 * - Retry
 * - انتظار متدرج
 * - حساب حجم البيانات
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

    const timeout =
      setTimeout(() => {
        controller.abort();
      }, PAGE_TIMEOUT_MS);

    try {
      console.log(
        `⬇️ الصفحة ${pageNumber}/${totalPages} — محاولة ${attempt}/${PAGE_RETRIES}`
      );

      const response =
        await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      clearTimeout(timeout);

      if (!arrayBuffer.byteLength) {
        throw new Error(
          `الصفحة ${pageNumber} فارغة.`
        );
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "image/jpeg";

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

      console.log(
        `⚠️ فشل الصفحة ${pageNumber}: ${lastError}`
      );

      if (
        attempt < PAGE_RETRIES
      ) {
        /*
         * انتظار متدرج:
         *
         * المحاولة الثانية = 1 ثانية
         * المحاولة الثالثة = 2 ثانية
         */
        const retryDelay =
          attempt * 1000;

        console.log(
          `🔄 إعادة المحاولة بعد ${retryDelay / 1000} ثانية...`
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
 * التحقق من ترتيب الصفحات.
 *
 * نتأكد أن:
 *
 * 1
 * 2
 * 3
 * 4
 * ...
 *
 * بدون تكرار أو نقص.
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
      pageRows[i].page_number;

    if (
      actualNumber !==
      expectedNumber
    ) {
      throw new Error(
        `ترتيب الصفحات غير صحيح عند الصفحة ${expectedNumber}. تم العثور على ${actualNumber}.`
      );
    }
  }

  /*
   * فحص إضافي للتكرار.
   */
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

  console.log(
    `✅ تم التأكد من ترتيب ${expectedPageCount} صفحة: 1 → ${expectedPageCount}`
  );
}

/*
 * التحقق من المستخدم الإداري.
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
    profile?.role !== "admin"
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
 * إنشاء المانغا إذا لم تكن موجودة.
 *
 * تم تعديل هذا الجزء فقط:
 *
 * - جلب الغلاف الرسمي من MangaDex.
 * - تحديث cover_url إذا كانت المانغا موجودة
 *   وكان الغلاف مختلفًا أو فارغًا.
 */
async function ensureMangaExists(
  supabase: any,
  mangaDexId: string
) {
  console.log(
    "🔎 البحث عن المانغا في AL TITIZE..."
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
      `فشل البحث عن المانغا: ${existingError.message}`
    );
  }

  /*
   * جلب معلومات MangaDex للحصول على
   * الغلاف الرسمي.
   *
   * getMangaInfo() يعيد coverUrl
   * بعد جلب cover_art.
   */
  const mangaInfo =
    await getMangaInfo(
      mangaDexId
    );

  const officialCoverUrl =
    mangaInfo?.coverUrl ||
    null;

  if (existingManga) {
    console.log(
      "✅ المانغا موجودة بالفعل:",
      existingManga.title
    );

    /*
     * إذا كان الغلاف الموجود مختلفًا
     * عن الغلاف الرسمي في MangaDex،
     * نقوم بتحديثه.
     */
    if (
      officialCoverUrl &&
      existingManga.cover_url !==
        officialCoverUrl
    ) {
      console.log(
        "🖼️ تحديث غلاف المانغا إلى الغلاف الرسمي من MangaDex..."
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
          `فشل تحديث غلاف المانغا: ${updateError.message}`
        );
      }

      console.log(
        "✅ تم تحديث الغلاف:",
        officialCoverUrl
      );

      return updatedManga;
    }

    return existingManga;
  }

  console.log(
    "📕 المانغا غير موجودة، سيتم إنشاؤها تلقائيًا..."
  );

  const attributes =
    mangaInfo?.data?.attributes ||
    {};

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
    "";

  /*
   * الغلاف الرسمي الذي تم جلبه
   * من MangaDex.
   */
  const coverUrl =
    officialCoverUrl;

  const {
    data: newManga,
    error: insertError,
  } =
    await supabase
      .from("manga")
      .insert({
        title: String(title),
        description:
          String(description),
        cover_url:
          coverUrl,
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
        "فشل إنشاء المانغا في AL TITIZE."
    );
  }

  console.log(
    "🎉 تم إنشاء المانغا:",
    newManga.id
  );

  return newManga;
}

/*
 * استيراد فصل واحد.
 */
async function importOneChapter(
  supabase: any,
  manga: any,
  chapterDexId: string
): Promise<ImportChapterResult> {
  let createdChapterId:
    | number
    | null = null;

  /*
   * الملفات التي تم رفعها.
   * نستخدمها للتنظيف إذا فشل الفصل.
   */
  const uploadedFilePaths: string[] =
    [];

  let downloadedBytes = 0;
  let uploadedBytes = 0;

  try {
    console.log(
      "================================="
    );

    console.log(
      "🚀 بدء استيراد الفصل:",
      chapterDexId
    );

    /*
     * 1. معلومات الفصل
     */
    console.log(
      "📖 جلب معلومات الفصل..."
    );

    const chapter =
      await getChapterInfo(
        chapterDexId
      );

    /*
     * 2. رقم الفصل
     */
    const chapterNumber =
      Number(chapter.chapter);

    console.log(
      "📚 رقم الفصل:",
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
     * 3. التحقق من الفصل
     */
    console.log(
      "🔎 البحث عن فصل موجود..."
    );

    const {
      data: existingChapter,
      error: existingChapterError,
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
      console.log(
        `⏭️ الفصل ${chapterNumber} موجود بالفعل.`
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
     * 4. جلب الصفحات
     */
    console.log(
      "🖼️ جلب قائمة صفحات الفصل..."
    );

    const rawPages =
      await getChapterPages(
        chapterDexId
      );

    console.log(
      `✅ عدد الصفحات من MangaDex: ${rawPages.length}`
    );

    if (!rawPages.length) {
      throw new Error(
        "لم يتم العثور على صفحات لهذا الفصل."
      );
    }

    /*
     * ترتيب صفحات المصدر قبل أي معالجة.
     *
     * حتى لو تغير ترتيب البيانات القادمة
     * من API، سنعيدها دائمًا:
     *
     * 1 → 2 → 3 → 4 → ...
     */
    const pages =
      [...rawPages].sort(
        (a, b) =>
          a.page_number -
          b.page_number
      );

    /*
     * التحقق من ترتيب صفحات المصدر.
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

    console.log(
      `🔒 تم تثبيت ترتيب المصدر: 1 → ${pages.length}`
    );

    /*
     * 5. إنشاء الفصل
     */
    console.log(
      "➕ إنشاء الفصل..."
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

    /*
     * 6. تحميل ورفع الصفحات
     *
     * صفحتان فقط في نفس الوقت.
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
          i + PAGE_CONCURRENCY
        );

      console.log(
        `⚡ دفعة صفحات: ${i + 1}-${Math.min(
          i +
            PAGE_CONCURRENCY,
          pages.length
        )}/${pages.length}`
      );

      /*
       * تشغيل صفحتين فقط في نفس الوقت.
       */
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

              /*
               * حساب حجم التحميل.
               */
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

              /*
               * المسار يعتمد على
               * رقم الصفحة الحقيقي.
               */
              const filePath =
                `chapters/${newChapter.id}/page-${page.page_number}.${extension}`;

              console.log(
                `⬆️ رفع الصفحة ${page.page_number}/${pages.length}...`
              );

              const {
                error: uploadError,
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

                      /*
                       * يسمح بإعادة الرفع
                       * لنفس الصفحة عند الحاجة.
                       */
                      upsert: true,
                    }
                  );

              if (uploadError) {
                throw new Error(
                  `فشل رفع الصفحة ${page.page_number}: ${uploadError.message}`
                );
              }

              /*
               * حساب حجم الرفع.
               */
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

              console.log(
                `✅ الصفحة ${page.page_number}/${pages.length} مكتملة — ${bytesToMB(
                  downloaded.bytes
                ).toFixed(2)} MB`
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

      /*
       * إضافة نتائج الدفعة.
       */
      pageRows.push(
        ...batchResults
      );

      /*
       * ترتيب مؤقت بعد كل دفعة.
       */
      pageRows.sort(
        (a, b) =>
          a.page_number -
          b.page_number
      );

      console.log(
        `📊 التقدم: ${Math.min(
          i +
            PAGE_CONCURRENCY,
          pages.length
        )}/${pages.length} صفحة`
      );

      console.log(
        `📥 تم تنزيل: ${bytesToMB(
          downloadedBytes
        ).toFixed(2)} MB`
      );

      console.log(
        `📤 تم رفع: ${bytesToMB(
          uploadedBytes
        ).toFixed(2)} MB`
      );
    }

    /*
     * ==================================================
     * التحقق النهائي من الصفحات قبل قاعدة البيانات
     * ==================================================
     */

    console.log(
      "🔐 التحقق النهائي من ترتيب الصفحات..."
    );

    /*
     * ترتيب صارم نهائي.
     */
    pageRows.sort(
      (a, b) =>
        a.page_number -
        b.page_number
    );

    /*
     * التحقق من العدد والترتيب
     * والتكرار.
     */
    validatePageOrder(
      pageRows,
      pages.length
    );

    /*
     * تأكيد إضافي أن كل الصفحات
     * تخص الفصل الحالي.
     */
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

    console.log(
      "✅ جميع الصفحات مؤكدة قبل الحفظ."
    );

    /*
     * 7. حفظ الصفحات في قاعدة البيانات.
     */
    console.log(
      "💾 حفظ الصفحات في قاعدة البيانات..."
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

    console.log(
      `✅ تم حفظ ${pageRows.length} صفحة بالترتيب الصحيح.`
    );

    const totalBytes =
      downloadedBytes +
      uploadedBytes;

    console.log(
      "================================="
    );

    console.log(
      `🎉 تم استيراد الفصل ${chapterNumber}`
    );

    console.log(
      `📄 الصفحات: ${pageRows.length}`
    );

    console.log(
      `🔢 الترتيب: 1 → ${pageRows.length}`
    );

    console.log(
      `📥 تحميل: ${bytesToMB(
        downloadedBytes
      ).toFixed(2)} MB`
    );

    console.log(
      `📤 رفع: ${bytesToMB(
        uploadedBytes
      ).toFixed(2)} MB`
    );

    console.log(
      `🌐 إجمالي حركة الاستيراد: ${bytesToMB(
        totalBytes
      ).toFixed(2)} MB`
    );

    console.log(
      "================================="
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
        `تم استيراد الفصل ${chapterNumber} بنجاح وبترتيب ${pageRows.length} صفحة.`,
    };
  } catch (error) {
    console.log(
      "❌ فشل استيراد الفصل:",
      error
    );

    /*
     * تنظيف الملفات المرفوعة.
     */
    if (
      uploadedFilePaths.length
    ) {
      console.log(
        `🧹 حذف ${uploadedFilePaths.length} ملف من Storage...`
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
        console.log(
          "⚠️ فشل تنظيف بعض الملفات:",
          storageDeleteError.message
        );
      } else {
        console.log(
          "✅ تم تنظيف ملفات Storage."
        );
      }
    }

    /*
     * حذف الفصل الناقص.
     */
    if (createdChapterId) {
      console.log(
        "🧹 حذف الفصل الناقص:",
        createdChapterId
      );

      await supabase
        .from("chapters")
        .delete()
        .eq(
          "id",
          createdChapterId
        );
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
 * استيراد فصل واحد يدويًا.
 */
export async function importChapterAction(
  mangaDexId: string,
  chapterDexId: string
) {
  console.log(
    "🚀 استيراد فصل واحد يدويًا"
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
 * استيراد دفعة كاملة.
 */
export async function importChaptersBatchAction(
  mangaDexId: string,
  chapters: ChapterToImport[]
): Promise<BatchImportResult> {
  console.log(
    "================================="
  );

  console.log(
    "📦 بدء استيراد دفعة كاملة"
  );

  console.log(
    "MangaDex ID:",
    mangaDexId
  );

  console.log(
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

  try {
    /*
     * إنشاء/البحث عن المانغا.
     */
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

    /*
     * الفصول بالتتابع.
     *
     * صفحات الفصل الواحد:
     * 2 في نفس الوقت.
     */
    for (const chapter of chapters) {
      console.log(
        `📦 معالجة الفصل ${
          chapter.chapter ||
          "بدون رقم"
        }...`
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

      console.log(
        "---------------------------------"
      );

      console.log(
        `📊 إحصائيات الدفعة حتى الآن`
      );

      console.log(
        `📥 تم تنزيل: ${bytesToMB(
          totalDownloadedBytes
        ).toFixed(2)} MB`
      );

      console.log(
        `📤 تم رفع: ${bytesToMB(
          totalUploadedBytes
        ).toFixed(2)} MB`
      );

      console.log(
        `🌐 الإجمالي: ${bytesToMB(
          totalDownloadedBytes +
            totalUploadedBytes
        ).toFixed(2)} MB`
      );

      console.log(
        "---------------------------------"
      );
    }

    const totalBytes =
      totalDownloadedBytes +
      totalUploadedBytes;

    console.log(
      "================================="
    );

    console.log(
      "🎉 انتهت الدفعة"
    );

    console.log(
      `📥 إجمالي التحميل: ${bytesToMB(
        totalDownloadedBytes
      ).toFixed(2)} MB`
    );

    console.log(
      `📤 إجمالي الرفع: ${bytesToMB(
        totalUploadedBytes
      ).toFixed(2)} MB`
    );

    console.log(
      `🌐 إجمالي حركة البيانات: ${bytesToMB(
        totalBytes
      ).toFixed(2)} MB`
    );

    console.log(
      `🌐 إجمالي حركة البيانات: ${bytesToGB(
        totalBytes
      ).toFixed(2)} GB`
    );

    console.log(
      `📚 تم الاستيراد: ${imported}`
    );

    console.log(
      `⏭️ تم التخطي: ${skipped}`
    );

    console.log(
      `❌ فشل: ${failed}`
    );

    console.log(
      `📄 إجمالي الصفحات: ${totalPages}`
    );

    console.log(
      "================================="
    );

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
    console.log(
      "❌ فشل استيراد الدفعة:",
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