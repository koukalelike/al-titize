import type {
  LicensedChapterPageProvider,
  NormalizedChapterPage,
} from "@/lib/data-sources/types";
import { getMangaDexChapterPages } from "@/lib/mangadex";

export type ChapterPagesInput = {
  chapterId: string;
  mangaDexId: string;
  mangaTitle: string;
  chapterNumber: string | null;
  language: string;
};

export async function getChapterPages(
  input: ChapterPagesInput,
  licensedFallback?: LicensedChapterPageProvider
): Promise<NormalizedChapterPage[]> {
  let mangaDexError: unknown;

  try {
    const pages = await getMangaDexChapterPages(input.chapterId);
    if (pages.length > 0) {
      return pages.map((page) => ({ ...page, source: "mangadex" }));
    }

    mangaDexError = new Error(
      `MangaDex لم يرسل صفحات للفصل ${input.chapterNumber ?? input.chapterId}.`
    );
  } catch (primaryError) {
    mangaDexError = primaryError;
  }

  if (!licensedFallback) {
    throw mangaDexError instanceof Error
      ? mangaDexError
      : new Error("تعذر جلب صفحات الفصل من MangaDex.");
  }

  try {
    const fallbackPages = await licensedFallback({
      mangaDexId: input.mangaDexId,
      mangaTitle: input.mangaTitle,
      chapterNumber: input.chapterNumber,
      language: input.language,
    });

    if (fallbackPages?.length) {
      return fallbackPages;
    }
  } catch (fallbackError) {
    const detail =
      fallbackError instanceof Error
        ? fallbackError.message
        : "تعذر الاتصال بالمصدر الاحتياطي.";

    throw new Error(
      `لم يرسل MangaDex صفحات للفصل ${input.chapterNumber ?? input.chapterId}، وتعذر Consumet: ${detail}`
    );
  }

  throw new Error(
    `لم يرسل MangaDex صفحات للفصل ${input.chapterNumber ?? input.chapterId}، ولم يجد Consumet فصلًا مطابقًا باللغة نفسها.`
  );
}
