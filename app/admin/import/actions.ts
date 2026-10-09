"use server";

import { createClient } from "@/lib/supabase/server";
import { getChapterInfo } from "@/lib/mangadex";
import { getUnifiedMangaMetadata } from "@/lib/data-sources/catalog";
import { getChapterPages } from "@/lib/data-sources/chapter-pages";
import { getConsumetChapterPages } from "@/lib/data-sources/consumet";

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
  source?: "mangadex" | "consumet";
  skipped?: boolean;
  error?: string;
  message?: string;
};

type BatchImportResult = {
  success: boolean;
  mangaId?: number;
  imported: number;
  skipped: number;
  failed: number;
  totalPages: number;

  results: {
    chapterId: string;
    chapterNumber: number | null;
    pages: number;
    success: boolean;
    skipped: boolean;
    source?: "mangadex" | "consumet";
    error?: string;
  }[];

  error?: string;
};

type ImportManga = {
  id: number;
  title: string;
  description: string;
  cover_url: string | null;
  status: string;
  mangadex_id: string;
};

type ImportSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/*
 * إعدادات الأداء
 *
 * 4 صفحات في نفس الوقت بدل 2.
 *
 * الترتيب النهائي لا يتأثر لأننا نرتب
 * جميع الصفحات قبل حفظها في قاعدة البيانات.
 */
const PAGE_CONCURRENCY = 4;
const PAGE_RETRIES = 3;
const PAGE_TIMEOUT_MS = 30_000;

/*
 * تأخير بسيط
 */
function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

/*
 * تحميل صفحة مع:
 * - Timeout
 * - Retry
 * - انتظار متدرج
 */
async function downloadPageWithRetry(
  url: string,
  pageNumber: number,
  headers?: Record<string, string>
) {
  let lastError = "فشل تحميل الصفحة.";

  for (
    let attempt = 1;
    attempt <= PAGE_RETRIES;
    attempt++
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, PAGE_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
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
        response.headers.get("content-type") ||
        "image/jpeg";

      return {
        arrayBuffer,
        contentType,
      };
    } catch (error) {
      clearTimeout(timeout);

      lastError =
        error instanceof Error
          ? error.name === "AbortError"
            ? `انتهت مهلة تحميل الصفحة ${pageNumber}.`
            : error.message
          : `فشل تحميل الصفحة ${pageNumber}.`;

      if (attempt < PAGE_RETRIES) {
        const retryDelay = attempt * 1000;
        await sleep(retryDelay);
      }
    }
  }

  throw new Error(
    `فشل تحميل الصفحة ${pageNumber} بعد ${PAGE_RETRIES} محاولات: ${lastError}`
  );
}

/*
 * التحقق من ترتيب الصفحات
 */
function validatePageOrder(
  pageRows: {
    chapter_id: number;
    page_number: number;
    image_url: string;
  }[],
  expectedPageCount: number
) {
  if (pageRows.length !== expectedPageCount) {
    throw new Error(
      `عدد الصفحات غير صحيح: تم تجهيز ${pageRows.length} من أصل ${expectedPageCount}.`
    );
  }

  for (
    let i = 0;
    i < pageRows.length;
    i++
  ) {
    const expectedNumber = i + 1;
    const actualNumber =
      pageRows[i].page_number;

    if (actualNumber !== expectedNumber) {
      throw new Error(
        `ترتيب الصفحات غير صحيح عند الصفحة ${expectedNumber}. تم العثور على ${actualNumber}.`
      );
    }
  }

  const pageNumbers = new Set(
    pageRows.map(
      (page) => page.page_number
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

}

/*
 * التحقق من المستخدم الإداري
 */
async function checkAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      error: "يجب تسجيل الدخول أولاً.",
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
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

  if (profile?.role !== "admin") {
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
 * إنشاء/البحث عن المانغا
 *
 * مهم:
 * في كل مرة يتم فيها استيراد مانغا،
 * نحدّث بياناتها من المصدر الموحد
 * مع إبقاء MangaDex مصدر الفصول والصفحات.
 */
async function ensureMangaExists(
  supabase: ImportSupabaseClient,
  mangaDexId: string
): Promise<ImportManga> {
  const {
    data: existingManga,
    error: existingError,
  } = await supabase
    .from("manga")
    .select(
      "id, title, description, cover_url, status, mangadex_id"
    )
    .eq("mangadex_id", mangaDexId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `فشل البحث عن المانغا: ${existingError.message}`
    );
  }

  /*
   * جلب بيانات المانغا الموحّدة
   */
  const metadata =
    await getUnifiedMangaMetadata(mangaDexId);

  const preferredCoverUrl =
    metadata.coverUrl;

  const baseMangaFields = {
    title: metadata.title,
    description: metadata.description ?? existingManga?.description ?? "",
    cover_url: preferredCoverUrl ?? existingManga?.cover_url ?? null,
    status: metadata.status,
    mangadex_id: mangaDexId,
  };

  const extendedMangaFields = {
    ...baseMangaFields,
    anilist_id: metadata.sourceIds.anilist,
    genres: metadata.genres,
    average_score: metadata.averageScore,
    metadata_source: metadata.source,
  };

  /*
   * المانغا موجودة بالفعل
   */
  if (existingManga) {
    const updateManga = (fields: Record<string, unknown>) =>
      supabase
        .from("manga")
        .update(fields)
        .eq("id", existingManga.id)
        .select(
          "id, title, description, cover_url, status, mangadex_id"
        )
        .single();

    const fields =
      metadata.source === "anilist"
        ? extendedMangaFields
        : baseMangaFields;

    let { data: updatedManga, error: updateError } =
      await updateManga(fields);

    if (
      updateError &&
      metadata.source === "anilist" &&
      (updateError.code === "42703" || updateError.code === "PGRST204")
    ) {
      ({ data: updatedManga, error: updateError } =
        await updateManga(baseMangaFields));
    }

    if (updateError || !updatedManga) {
      throw new Error(
        `فشل تحديث بيانات المانغا: ${updateError?.message ?? "تعذر تحميل النتيجة."}`
      );
    }

    return updatedManga;
  }

  /*
   * المانغا غير موجودة
   */

  const saveManga = (fields: Record<string, unknown>) =>
    supabase
      .from("manga")
      .insert(fields)
      .select(
        "id, title, description, cover_url, status, mangadex_id"
      )
      .single();

  let { data: newManga, error: insertError } =
    await saveManga(
      metadata.source === "anilist"
        ? extendedMangaFields
        : baseMangaFields
    );

  if (
    insertError &&
    (insertError.code === "42703" || insertError.code === "PGRST204")
  ) {
    ({ data: newManga, error: insertError } =
      await saveManga(baseMangaFields));
  }

  if (insertError || !newManga) {
    throw new Error(
      insertError?.message ||
        "فشل إنشاء المانغا في AL TITIZE."
    );
  }

  return newManga;
}

/*
 * استيراد فصل واحد
 */
async function importOneChapter(
  supabase: ImportSupabaseClient,
  manga: ImportManga,
  chapterDexId: string
): Promise<ImportChapterResult> {
  let createdChapterId:
    | number
    | null = null;

  const uploadedFilePaths: string[] =
    [];
  let pageSource: "mangadex" | "consumet" | undefined;

  try {
    /*
     * 1. معلومات الفصل
     */
    const chapter =
      await getChapterInfo(
        chapterDexId
      );

    /*
     * 2. رقم الفصل
     */
    const chapterNumberText =
      chapter.chapter === null
        ? ""
        : String(chapter.chapter).trim();

    const chapterNumber =
      chapterNumberText
        ? Number(chapterNumberText)
        : Number.NaN;

    if (
      !Number.isFinite(
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

    const {
      data: existingChapter,
      error: existingChapterError,
    } = await supabase
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

    if (existingChapterError) {
      throw new Error(
        `فشل التحقق من الفصل: ${existingChapterError.message}`
      );
    }

    if (existingChapter) {
      const { error: attributionError } = await supabase
        .from("chapters")
        .update({
          mangadex_chapter_id: chapter.id,
          scanlation_groups:
            chapter.scanlationGroups ?? [],
        })
        .eq("id", existingChapter.id);

      if (attributionError) {
        throw new Error(
          `فشل تحديث مصدر الفصل وفرق الترجمة: ${attributionError.message}`
        );
      }

      return {
        success: true,
        skipped: true,
        chapterNumber,
        pages: 0,
        message: `الفصل ${chapterNumber} موجود؛ تم تحديث بيانات المصدر وفرق الترجمة دون إعادة رفع الصفحات.`,
      };
    }

    /*
     * 4. جلب الصفحات
     */

    const rawPages =
      await getChapterPages(
        {
          chapterId: chapterDexId,
          mangaDexId: manga.mangadex_id,
          mangaTitle: manga.title,
          chapterNumber: chapterNumberText || null,
          language: chapter.language,
        },
        getConsumetChapterPages
      );

    if (!rawPages.length) {
      throw new Error(
        "لم يتم العثور على صفحات لهذا الفصل."
      );
    }

    pageSource = rawPages[0].source;

    /*
     * ترتيب صفحات المصدر
     */
    const pages =
      [...rawPages].sort(
        (a, b) =>
          a.page_number -
          b.page_number
      );

    /*
     * التحقق من ترتيب صفحات المصدر
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

    /*
     * 5. إنشاء الفصل
     */

    const {
      data: newChapter,
      error: chapterError,
    } = await supabase
      .from("chapters")
      .insert({
        manga_id:
          manga.id,
        chapter_number:
          chapterNumber,
        title:
          chapter.title ||
          `Chapter ${chapterNumber}`,
        mangadex_chapter_id:
          chapter.id,
        scanlation_groups:
          chapter.scanlationGroups ?? [],
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
     * يتم تنفيذ 4 صفحات في نفس الوقت.
     *
     * كل صفحة:
     * 1. تُحمّل من المصدر الذي وفر الصفحة (MangaDex أو Consumet)
     * 2. تُرفع إلى Supabase
     *
     * وبعد انتهاء جميع الدفعات،
     * يتم ترتيب pageRows قبل الحفظ.
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

      const batchResults =
        await Promise.all(
          currentPages.map(
            async (page) => {
              const downloaded =
                await downloadPageWithRetry(
                  page.image_url,
                  page.page_number,
                  page.headers
                );

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

              const {
                error: uploadError,
              } =
                await supabase.storage
                  .from("manga-pages")
                  .upload(
                    filePath,
                    downloaded.arrayBuffer,
                    {
                      contentType:
                        downloaded.contentType,
                      upsert: true,
                    }
                  );

              if (uploadError) {
                throw new Error(
                  `فشل رفع الصفحة ${page.page_number}: ${uploadError.message}`
                );
              }

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
       * نضيف النتائج فقط.
       *
       * لا نعمل sort هنا لأن ذلك كان
       * يحدث بعد كل دفعة ويضيف عملاً
       * غير ضروري.
       */
      pageRows.push(
        ...batchResults
      );

    }

    /*
     * التحقق النهائي
     */

    /*
     * ترتيب واحد فقط قبل التحقق والحفظ.
     */
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
     * 7. حفظ الصفحات
     */

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

    return {
      success: true,
      skipped: false,
      chapterId:
        newChapter.id,
      chapterNumber,
      pages:
        pageRows.length,
      source: pageSource,
      message:
        `تم استيراد الفصل ${chapterNumber} بنجاح وبترتيب ${pageRows.length} صفحة.`,
    };
  } catch (error) {

    /*
     * تنظيف الملفات
     */
    if (
      uploadedFilePaths.length
    ) {

      await supabase.storage
        .from("manga-pages")
        .remove(uploadedFilePaths);
    }

    /*
     * حذف الفصل الناقص
     */
    if (createdChapterId) {

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
      source: pageSource,
      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء استيراد الفصل.",
    };
  }
}

/*
 * استيراد فصل واحد يدويًا
 */
export async function importChapterAction(
  mangaDexId: string,
  chapterDexId: string
) {

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
 * استيراد دفعة كاملة
 */
export async function importChaptersBatchAction(
  mangaDexId: string,
  chapters: ChapterToImport[]
): Promise<BatchImportResult> {
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
      results: [],
      error:
        "لم يتم إرسال أي فصول للاستيراد.",
    };
  }

  if (chapters.length > 100) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      totalPages: 0,
      results: [],
      error: "يُسمح باستيراد 100 فصل كحد أقصى في كل دفعة.",
    };
  }

  try {
    /*
     * إنشاء/البحث عن المانغا
     * ويتم هنا تحديث بيانات المانغا أيضًا.
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

    const results: BatchImportResult["results"] =
      [];

    /*
     * الفصول بالتتابع
     */
    for (
      const chapter of chapters
    ) {
      const result =
        await importOneChapter(
          supabase,
          manga,
          chapter.id
        );

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

        source:
          result.source,

        error:
          result.error,
      });
    }

    return {
      success:
        failed === 0,

      mangaId:
        manga.id,

      imported,

      skipped,

      failed,

      totalPages,

      results,

      error:
        failed > 0
          ? `تم استيراد ${imported} فصل، وتخطي ${skipped} فصل، وفشل ${failed} فصل.`
          : undefined,
    };
  } catch (error) {
    return {
      success: false,

      imported: 0,

      skipped: 0,

      failed:
        chapters.length,

      totalPages: 0,

      results: [],

      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء استيراد الدفعة.",
    };
  }
}
