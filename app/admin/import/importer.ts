import { createClient } from "@/lib/supabase/server";
import {
  getChapterInfo,
  getChapterPages,
  getMangaInfo,
} from "@/lib/mangadex";

export type ChapterToImport = {
  id: string;
  chapter: string | null;
  title: string;
  language: string;
  pages: number;
  volume: string | null;
};

export type ImportProgress = {
  type:
    | "start"
    | "manga"
    | "chapter"
    | "page"
    | "upload"
    | "success"
    | "skip"
    | "error"
    | "complete";

  message: string;

  chapterNumber?: number | null;
  chapterIndex?: number;
  totalChapters?: number;

  pageNumber?: number;
  totalPages?: number;

  imported?: number;
  skipped?: number;
  failed?: number;
  totalImportedPages?: number;

  downloadedBytes?: number;
  uploadedBytes?: number;
  totalBytes?: number;

  error?: string;
};

export type ImportChapterResult = {
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

type ProgressCallback = (
  progress: ImportProgress
) => void | Promise<void>;

const PAGE_CONCURRENCY = 4;
const PAGE_RETRIES = 3;
const PAGE_TIMEOUT_MS = 30_000;

function bytesToMB(bytes: number) {
  return bytes / 1024 / 1024;
}

function bytesToGB(bytes: number) {
  return bytes / 1024 / 1024 / 1024;
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

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

async function emit(
  onProgress: ProgressCallback | undefined,
  progress: ImportProgress
) {
  if (!onProgress) {
    return;
  }

  try {
    await onProgress(progress);
  } catch (error) {
    console.error(
      "[AL TITIZE IMPORTER] Progress callback error:",
      error
    );
  }
}

function log(
  message: string,
  value?: unknown
) {
  if (typeof value === "undefined") {
    console.log(
      `[AL TITIZE IMPORTER] ${message}`
    );
    return;
  }

  console.log(
    `[AL TITIZE IMPORTER] ${message}`,
    value
  );
}

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

async function ensureMangaExists(
  supabase: any,
  mangaDexId: string,
  onProgress?: ProgressCallback
) {
  await emit(onProgress, {
    type: "manga",
    message:
      "جاري التحقق من المانجا...",
  });

  log(
    "Checking manga:",
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

  await emit(onProgress, {
    type: "manga",
    message:
      "جاري جلب بيانات المانجا والغلاف من MangaDex...",
  });

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

  if (existingManga) {
    if (
      officialCoverUrl &&
      existingManga.cover_url !==
        officialCoverUrl
    ) {
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

      await emit(onProgress, {
        type: "manga",
        message:
          "✅ تم تحديث غلاف المانجا.",
      });

      return updatedManga;
    }

    await emit(onProgress, {
      type: "manga",
      message:
        `✅ تم العثور على المانجا: ${existingManga.title}`,
    });

    return existingManga;
  }

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

  await emit(onProgress, {
    type: "manga",
    message:
      `✅ تم إنشاء المانجا: ${newManga.title}`,
  });

  return newManga;
}

async function downloadPageWithRetry(
  url: string,
  pageNumber: number,
  totalPages: number,
  onProgress?: ProgressCallback
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
      setTimeout(
        () => {
          controller.abort();
        },
        PAGE_TIMEOUT_MS
      );

    try {
      await emit(onProgress, {
        type: "page",
        message: `⬇️ تحميل الصفحة ${pageNumber}/${totalPages} — المحاولة ${attempt}/${PAGE_RETRIES}`,
        pageNumber,
        totalPages,
      });

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

      log(
        `Downloaded page ${pageNumber}/${totalPages}: ${formatBytes(
          arrayBuffer.byteLength
        )}`
      );

      return {
        arrayBuffer,
        contentType,
        bytes:
          arrayBuffer.byteLength,
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

      await emit(onProgress, {
        type: "error",
        message:
          `❌ فشل تحميل الصفحة ${pageNumber}: ${lastError}`,
        pageNumber,
        totalPages,
        error:
          lastError,
      });

      if (
        attempt < PAGE_RETRIES
      ) {
        await sleep(
          attempt * 1000
        );
      }
    }
  }

  throw new Error(
    `فشل تحميل الصفحة ${pageNumber} بعد ${PAGE_RETRIES} محاولات: ${lastError}`
  );
}

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
    if (
      pageRows[i].page_number !==
      i + 1
    ) {
      throw new Error(
        `ترتيب الصفحات غير صحيح عند الصفحة ${i + 1}.`
      );
    }
  }

  const uniquePages =
    new Set(
      pageRows.map(
        (page) =>
          page.page_number
      )
    );

  if (
    uniquePages.size !==
    expectedPageCount
  ) {
    throw new Error(
      "تم العثور على صفحات مكررة."
    );
  }
}

async function importOneChapter(
  supabase: any,
  manga: any,
  chapterDexId: string,
  chapterIndex: number,
  totalChapters: number,
  onProgress?: ProgressCallback
): Promise<ImportChapterResult> {
  let createdChapterId:
    | number
    | null = null;

  const uploadedFilePaths:
    string[] = [];

  let downloadedBytes = 0;
  let uploadedBytes = 0;

  try {
    await emit(onProgress, {
      type: "chapter",
      message:
        `📖 بدء معالجة الفصل ${chapterIndex}/${totalChapters}...`,
      chapterIndex,
      totalChapters,
    });

    const chapter =
      await getChapterInfo(
        chapterDexId
      );

    const chapterNumber =
      Number(chapter.chapter);

    if (
      !Number.isInteger(
        chapterNumber
      )
    ) {
      throw new Error(
        `رقم الفصل "${chapter.chapter}" غير صالح.`
      );
    }

    await emit(onProgress, {
      type: "chapter",
      message:
        `📖 الفصل ${chapterNumber}: جاري التحقق من وجوده...`,
      chapterNumber,
      chapterIndex,
      totalChapters,
    });

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
      await emit(onProgress, {
        type: "skip",
        message:
          `⏭️ الفصل ${chapterNumber} موجود مسبقًا.`,
        chapterNumber,
        chapterIndex,
        totalChapters,
      });

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

    await emit(onProgress, {
      type: "chapter",
      message:
        `🖼️ الفصل ${chapterNumber}: جاري جلب قائمة الصفحات...`,
      chapterNumber,
      chapterIndex,
      totalChapters,
    });

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

    const pages =
      [...rawPages].sort(
        (a, b) =>
          a.page_number -
          b.page_number
      );

    for (
      let i = 0;
      i < pages.length;
      i++
    ) {
      if (
        pages[i].page_number !==
        i + 1
      ) {
        throw new Error(
          `قائمة صفحات MangaDex غير مرتبة عند الصفحة ${i + 1}.`
        );
      }
    }

    await emit(onProgress, {
      type: "chapter",
      message:
        `📚 الفصل ${chapterNumber}: ${pages.length} صفحة.`,
      chapterNumber,
      chapterIndex,
      totalChapters,
      totalPages:
        pages.length,
    });

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

      const batchResults =
        await Promise.all(
          currentPages.map(
            async (page) => {
              const downloaded =
                await downloadPageWithRetry(
                  page.image_url,
                  page.page_number,
                  pages.length,
                  onProgress
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

              await emit(
                onProgress,
                {
                  type: "upload",
                  message:
                    `⬆️ رفع الصفحة ${page.page_number}/${pages.length}...`,
                  chapterNumber,
                  chapterIndex,
                  totalChapters,
                  pageNumber:
                    page.page_number,
                  totalPages:
                    pages.length,
                  downloadedBytes,
                  uploadedBytes,
                  totalBytes:
                    downloadedBytes +
                    uploadedBytes,
                }
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

              await emit(
                onProgress,
                {
                  type: "success",
                  message:
                    `✅ الصفحة ${page.page_number}/${pages.length} مكتملة.`,
                  chapterNumber,
                  chapterIndex,
                  totalChapters,
                  pageNumber:
                    page.page_number,
                  totalPages:
                    pages.length,
                  downloadedBytes,
                  uploadedBytes,
                  totalBytes:
                    downloadedBytes +
                    uploadedBytes,
                }
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

      await emit(
        onProgress,
        {
          type: "page",
          message:
            `📊 تقدم الفصل ${chapterNumber}: ${Math.min(
              i +
                PAGE_CONCURRENCY,
              pages.length
            )}/${pages.length} صفحة.`,
          chapterNumber,
          chapterIndex,
          totalChapters,
          pageNumber:
            Math.min(
              i +
                PAGE_CONCURRENCY,
              pages.length
            ),
          totalPages:
            pages.length,
          downloadedBytes,
          uploadedBytes,
          totalBytes:
            downloadedBytes +
            uploadedBytes,
        }
      );
    }

    pageRows.sort(
      (a, b) =>
        a.page_number -
        b.page_number
    );

    validatePageOrder(
      pageRows,
      pages.length
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

    await emit(onProgress, {
      type: "success",
      message:
        `🎉 تم استيراد الفصل ${chapterNumber} بنجاح.`,
      chapterNumber,
      chapterIndex,
      totalChapters,
      totalPages:
        pageRows.length,
      downloadedBytes,
      uploadedBytes,
      totalBytes:
        downloadedBytes +
        uploadedBytes,
    });

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
    const message =
      error instanceof Error
        ? error.message
        : "حدث خطأ أثناء استيراد الفصل.";

    await emit(onProgress, {
      type: "error",
      message: `❌ فشل استيراد الفصل: ${message}`,
      chapterIndex,
      totalChapters,
      downloadedBytes,
      uploadedBytes,
      totalBytes:
        downloadedBytes +
        uploadedBytes,
      error: message,
    });

    if (
      uploadedFilePaths.length
    ) {
      try {
        await supabase.storage
          .from(
            "manga-pages"
          )
          .remove(
            uploadedFilePaths
          );
      } catch (
        cleanupError
      ) {
        console.error(
          "[AL TITIZE IMPORTER] Storage cleanup failed:",
          cleanupError
        );
      }
    }

    if (createdChapterId) {
      try {
        await supabase
          .from("chapters")
          .delete()
          .eq(
            "id",
            createdChapterId
          );
      } catch (
        cleanupError
      ) {
        console.error(
          "[AL TITIZE IMPORTER] Chapter cleanup failed:",
          cleanupError
        );
      }
    }

    return {
      success: false,
      skipped: false,
      pages: 0,
      downloadedBytes,
      uploadedBytes,
      error: message,
    };
  }
}

export async function importChaptersWithProgress(
  mangaDexId: string,
  chapters: ChapterToImport[],
  onProgress?: ProgressCallback
): Promise<BatchImportResult> {
  await emit(onProgress, {
    type: "start",
    message:
      `🚀 بدء استيراد ${chapters.length} فصل...`,
    totalChapters:
      chapters.length,
  });

  const {
    supabase,
    error: authError,
  } =
    await checkAdmin();

  if (authError) {
    await emit(onProgress, {
      type: "error",
      message:
        `❌ ${authError}`,
      error:
        authError,
    });

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
        authError,
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
        mangaDexId,
        onProgress
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

      const result =
        await importOneChapter(
          supabase,
          manga,
          chapter.id,
          index + 1,
          chapters.length,
          onProgress
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

      await emit(onProgress, {
        type: "chapter",
        message:
          `📚 تمت معالجة ${index + 1}/${chapters.length} فصل.`,
        chapterNumber:
          result.chapterNumber,
        chapterIndex:
          index + 1,
        totalChapters:
          chapters.length,
        imported,
        skipped,
        failed,
        totalImportedPages:
          totalPages,
        downloadedBytes:
          totalDownloadedBytes,
        uploadedBytes:
          totalUploadedBytes,
        totalBytes:
          totalDownloadedBytes +
          totalUploadedBytes,
      });
    }

    const totalBytes =
      totalDownloadedBytes +
      totalUploadedBytes;

    const result: BatchImportResult = {
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

    await emit(onProgress, {
      type: "complete",
      message:
        failed === 0
          ? "🎉 اكتمل الاستيراد بنجاح."
          : "⚠️ انتهى الاستيراد مع وجود أخطاء.",
      imported,
      skipped,
      failed,
      totalImportedPages:
        totalPages,
      downloadedBytes:
        totalDownloadedBytes,
      uploadedBytes:
        totalUploadedBytes,
      totalBytes,
    });

    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "حدث خطأ أثناء استيراد الدفعة.";

    await emit(onProgress, {
      type: "error",
      message:
        `❌ فشل استيراد الدفعة: ${message}`,
      error: message,
    });

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
      error: message,
    };
  }
}