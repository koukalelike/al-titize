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
    error?: string;
  }[];
  error?: string;
};

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

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    return {
      supabase,
      user,
      error: "تعذر التحقق من صلاحيات المستخدم.",
    };
  }

  if (profile?.role !== "admin") {
    return {
      supabase,
      user,
      error: "ليس لديك صلاحية استيراد الفصول.",
    };
  }

  return {
    supabase,
    user,
    error: null,
  };
}

/*
 * إنشاء المانغا داخل AL TITIZE إذا لم تكن موجودة.
 */
async function ensureMangaExists(
  supabase: any,
  mangaDexId: string
) {
  console.log("🔎 البحث عن المانغا في AL TITIZE...");

  const { data: existingManga, error: existingError } =
    await supabase
      .from("manga")
      .select("id, title, description, cover_url, status, mangadex_id")
      .eq("mangadex_id", mangaDexId)
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `فشل البحث عن المانغا: ${existingError.message}`
    );
  }

  if (existingManga) {
    console.log(
      "✅ المانغا موجودة بالفعل:",
      existingManga.title
    );

    return existingManga;
  }

  console.log(
    "📕 المانغا غير موجودة، سيتم إنشاؤها تلقائيًا..."
  );

  const mangaInfo = await getMangaInfo(mangaDexId);

  const attributes =
    mangaInfo?.data?.attributes || {};

  const title =
    attributes?.title?.en ||
    Object.values(attributes?.title || {})[0] ||
    "بدون عنوان";

  const description =
    attributes?.description?.en ||
    Object.values(
      attributes?.description || {}
    )[0] ||
    "";

  const coverFile =
    mangaInfo?.data?.relationships?.find(
      (item: any) =>
        item.type === "cover_art"
    )?.attributes?.fileName;

  let coverUrl: string | null = null;

  if (coverFile) {
    coverUrl =
      `https://uploads.mangadex.org/covers/${mangaDexId}/${coverFile}`;
  }

  const { data: newManga, error: insertError } =
    await supabase
      .from("manga")
      .insert({
        title: String(title),
        description: String(description),
        cover_url: coverUrl,
        status: "ongoing",
        mangadex_id: mangaDexId,
      })
      .select(
        "id, title, description, cover_url, status, mangadex_id"
      )
      .single();

  if (insertError || !newManga) {
    throw new Error(
      insertError?.message ||
        "فشل إنشاء المانغا في AL TITIZE."
    );
  }

  console.log(
    "🎉 تم إنشاء المانغا في AL TITIZE:",
    newManga.id
  );

  return newManga;
}

/*
 * استيراد فصل واحد فعليًا.
 */
async function importOneChapter(
  supabase: any,
  manga: any,
  chapterDexId: string
): Promise<ImportChapterResult> {
  let createdChapterId: number | null = null;

  try {
    console.log(
      "================================="
    );

    console.log(
      "🚀 بدء استيراد الفصل:",
      chapterDexId
    );

    /*
     * 1. جلب معلومات الفصل
     */

    console.log(
      "📖 جلب معلومات الفصل من MangaDex..."
    );

    const chapter =
      await getChapterInfo(chapterDexId);

    console.log(
      "✅ معلومات الفصل:",
      chapter
    );

    /*
     * 2. تحويل رقم الفصل
     */

    const chapterNumber =
      Number(chapter.chapter);

    console.log(
      "📚 رقم الفصل:",
      chapterNumber
    );

    if (!Number.isInteger(chapterNumber)) {
      throw new Error(
        `رقم الفصل "${chapter.chapter}" غير صالح لقاعدة البيانات الحالية.`
      );
    }

    /*
     * 3. التأكد من عدم وجود الفصل
     */

    console.log(
      "🔎 البحث عن فصل موجود مسبقًا..."
    );

    const {
      data: existingChapter,
      error: existingChapterError,
    } = await supabase
      .from("chapters")
      .select("id")
      .eq("manga_id", manga.id)
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
      console.log(
        `⏭️ الفصل ${chapterNumber} موجود بالفعل، سيتم تخطيه.`
      );

      return {
        success: true,
        skipped: true,
        chapterNumber,
        pages: 0,
        message:
          `الفصل ${chapterNumber} موجود بالفعل.`,
      };
    }

    /*
     * 4. جلب الصفحات
     */

    console.log(
      "🖼️ جلب صفحات الفصل..."
    );

    const pages =
      await getChapterPages(chapterDexId);

    console.log(
      "✅ عدد الصفحات:",
      pages.length
    );

    if (!pages.length) {
      throw new Error(
        "لم يتم العثور على صفحات لهذا الفصل."
      );
    }

    /*
     * 5. إنشاء الفصل
     */

    console.log(
      "➕ إنشاء الفصل في قاعدة البيانات..."
    );

    const {
      data: newChapter,
      error: chapterError,
    } =
      await supabase
        .from("chapters")
        .insert({
          manga_id: manga.id,
          chapter_number: chapterNumber,
          title:
            chapter.title ||
            `Chapter ${chapterNumber}`,
        })
        .select("id")
        .single();

    if (chapterError || !newChapter) {
      throw new Error(
        chapterError?.message ||
          "فشل إنشاء الفصل."
      );
    }

    createdChapterId =
      newChapter.id;

    console.log(
      "✅ تم إنشاء الفصل:",
      createdChapterId
    );

    /*
     * 6. تحميل ورفع الصفحات
     */

    const pageRows: {
      chapter_id: number;
      page_number: number;
      image_url: string;
    }[] = [];

    for (const page of pages) {
      console.log(
        `⬇️ تحميل الصفحة ${page.page_number}/${pages.length}...`
      );

      const imageResponse =
        await fetch(page.image_url, {
          cache: "no-store",
        });

      if (!imageResponse.ok) {
        throw new Error(
          `فشل تحميل الصفحة ${page.page_number} من MangaDex.`
        );
      }

      const arrayBuffer =
        await imageResponse.arrayBuffer();

      const contentType =
        imageResponse.headers.get(
          "content-type"
        ) || "image/jpeg";

      const extension =
        contentType.includes("png")
          ? "png"
          : contentType.includes("webp")
          ? "webp"
          : "jpg";

      const filePath =
        `chapters/${newChapter.id}/page-${page.page_number}.${extension}`;

      console.log(
        `⬆️ رفع الصفحة ${page.page_number} إلى Supabase...`
      );

      const { error: uploadError } =
        await supabase.storage
          .from("manga-pages")
          .upload(
            filePath,
            arrayBuffer,
            {
              contentType,
              upsert: true,
            }
          );

      if (uploadError) {
        throw new Error(
          `فشل رفع الصفحة ${page.page_number}: ${uploadError.message}`
        );
      }

      const {
        data: publicUrlData,
      } =
        supabase.storage
          .from("manga-pages")
          .getPublicUrl(
            filePath
          );

      pageRows.push({
        chapter_id:
          newChapter.id,
        page_number:
          page.page_number,
        image_url:
          publicUrlData.publicUrl,
      });

      console.log(
        `✅ تم رفع الصفحة ${page.page_number}`
      );
    }

    /*
     * 7. حفظ الصفحات
     */

    console.log(
      "💾 حفظ صفحات الفصل..."
    );

    const { error: pagesError } =
      await supabase
        .from("pages")
        .insert(pageRows);

    if (pagesError) {
      throw new Error(
        `فشل حفظ صفحات الفصل: ${pagesError.message}`
      );
    }

    console.log(
      `🎉 تم استيراد الفصل ${chapterNumber} بنجاح.`
    );

    return {
      success: true,
      skipped: false,
      chapterId:
        newChapter.id,
      chapterNumber,
      pages:
        pageRows.length,
      message:
        `تم استيراد الفصل ${chapterNumber} بنجاح.`,
    };
  } catch (error) {
    console.log(
      "❌ فشل استيراد الفصل:",
      error
    );

    /*
     * حذف الفصل إذا فشل
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
      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء استيراد الفصل.",
    };
  }
}

/*
 * استيراد فصل واحد يدويًا.
 * يبقى موجودًا كخطة احتياطية.
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
  } = await checkAdmin();

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
 * استيراد دفعة كاملة تلقائيًا.
 *
 * هذه هي الدالة الجديدة التي ستستخدمها لوحة MangaDex.
 *
 * لا يوجد انتظار هنا.
 * الانتظار 10 ثوانٍ يبقى في page.tsx
 * بين الدفعات كما اتفقنا.
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
  } = await checkAdmin();

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

  try {
    /*
     * إنشاء المانغا تلقائيًا إذا لم تكن موجودة.
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
     * نستورد الفصول بالتتابع.
     *
     * ليس Promise.all
     * حتى لا نرسل عشرات الطلبات في نفس اللحظة.
     */

    for (const chapter of chapters) {
      console.log(
        `📦 معالجة الفصل ${chapter.chapter || "بدون رقم"}...`
      );

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
            ? Number(chapter.chapter)
            : null),
        pages:
          result.pages || 0,
        success:
          result.success,
        skipped:
          result.skipped || false,
        error:
          result.error,
      });

      /*
       * إذا فشل فصل واحد،
       * لا نوقف الدفعة كلها.
       *
       * ننتقل للفصل التالي.
       */
    }

    console.log(
      "================================="
    );

    console.log(
      "🎉 انتهت الدفعة"
    );

    console.log(
      "تم الاستيراد:",
      imported
    );

    console.log(
      "تم التخطي:",
      skipped
    );

    console.log(
      "فشل:",
      failed
    );

    console.log(
      "إجمالي الصفحات:",
      totalPages
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
      failed: chapters.length,
      totalPages: 0,
      results: [],
      error:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء استيراد الدفعة.",
    };
  }
}