import { MANGADEX_USER_AGENT } from "@/lib/data-sources/mangadex-headers";

const MANGADEX_API = "https://api.mangadex.org";
const MANGADEX_PROXY = "/api/mangadex";
const MANGADEX_UPLOADS = "https://uploads.mangadex.org";

type MangaDexChapterRecord = {
  id: string;
  attributes?: {
    chapter?: string | null;
    title?: string | null;
    translatedLanguage?: string | null;
    pages?: number | null;
    volume?: string | null;
  };
  relationships?: {
    id: string;
    type: string;
    attributes?: {
      name?: string | null;
    };
  }[];
};

type MangaDexChapterPage = {
  page_number: number;
  filename: string;
  image_url: string;
};

export type MangaDexSearchResult = {
  id: string;
  title: string;
  alternativeTitles: string[];
  coverUrl: string | null;
  status: string | null;
};

async function mangaDexFetch(path: string) {
  const isBrowser =
    typeof window !== "undefined";

  const url = isBrowser
    ? `${MANGADEX_PROXY}?path=${encodeURIComponent(path)}`
    : `${MANGADEX_API}${path}`;

  const response = await fetch(url, {
    cache: "no-store",
    ...(!isBrowser && {
      headers: {
        "User-Agent": MANGADEX_USER_AGENT,
      },
    }),
  });

  if (!response.ok) {
    let message = "";

    try {
      const data = await response.json();

      message =
        data?.error ||
        data?.message ||
        "";
    } catch {
      // تجاهل خطأ قراءة JSON
    }

    throw new Error(
      message ||
        `MangaDex API error: ${response.status}`
    );
  }

  return response.json();
}

export function getMangaId(
  input: string
): string | null {
  const value = input.trim();

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    return value;
  }

  const match = value.match(
    /mangadex\.org\/title\/([0-9a-f-]{36})/i
  );

  return match ? match[1] : null;
}

export async function searchMangaDexManga(
  query: string,
  limit = 12
): Promise<MangaDexSearchResult[]> {
  const searchTerm = query.trim();

  if (!searchTerm) {
    throw new Error("اكتب اسم المانغا للبحث عنها.");
  }

  const params = new URLSearchParams();
  params.set("title", searchTerm);
  params.set("limit", String(Math.min(Math.max(limit, 1), 20)));
  params.append("includes[]", "cover_art");

  const result = await mangaDexFetch(`/manga?${params.toString()}`);
  const mangaRecords = Array.isArray(result.data) ? result.data : [];

  return mangaRecords.map((record: {
    id: string;
    attributes?: {
      title?: Record<string, string>;
      altTitles?: Record<string, string>[];
      status?: string | null;
    };
    relationships?: {
      type?: string;
      attributes?: { fileName?: string | null };
    }[];
  }) => {
    const titles = record.attributes?.title ?? {};
    const primaryTitle =
      titles.en ||
      titles["ja-ro"] ||
      Object.values(titles)[0] ||
      "بدون عنوان";
    const coverFilename = record.relationships?.find(
      (relationship) => relationship.type === "cover_art"
    )?.attributes?.fileName;

    return {
      id: record.id,
      title: primaryTitle,
      alternativeTitles: (record.attributes?.altTitles ?? []).flatMap(
        (title) => Object.values(title)
      ),
      coverUrl: coverFilename
        ? `${MANGADEX_UPLOADS}/covers/${record.id}/${coverFilename}.512.jpg`
        : null,
      status: record.attributes?.status ?? null,
    };
  });
}

/*
 * جلب معلومات المانجا
 */
export async function getMangaInfo(
  input: string
) {
  const mangaId = getMangaId(input);

  if (!mangaId) {
    throw new Error(
      "رابط MangaDex أو Manga ID غير صحيح"
    );
  }

  const result =
    await mangaDexFetch(
      `/manga/${mangaId}?includes[]=cover_art`
    );

  const mangaData = result.data;

  /*
   * MangaDex يعيد الغلاف الأساسي
   * داخل relationships من نوع cover_art.
   */
  const coverRelationship =
    mangaData?.relationships?.find(
      (relationship: {
        type?: string;
        attributes?: { fileName?: string };
      }) =>
        relationship?.type ===
        "cover_art"
    );

  const fileName =
    coverRelationship?.attributes
      ?.fileName ??
    null;

  /*
   * رابط الغلاف الأصلي.
   */
  const originalCoverUrl =
    fileName
      ? `${MANGADEX_UPLOADS}/covers/${mangaId}/${fileName}`
      : null;

  /*
   * نستخدم نسخة 512px من MangaDex
   * لأنها أخف ومناسبة للعرض على الموقع.
   */
  const coverUrl =
    originalCoverUrl
      ? `${originalCoverUrl}.512.jpg`
      : null;

return {
    id: mangaId,
    data: mangaData,
    coverUrl,
  };
}

/*
 * جلب فصول لغة محددة
 */
export async function getMangaChapters(
  mangaId: string,
  language: string = "ar",
  limit: number = 100,
  offset: number = 0
) {
  const params =
    new URLSearchParams();

  params.append(
    "translatedLanguage[]",
    language
  );

  params.append(
    "limit",
    String(
      Math.min(limit, 100)
    )
  );

  params.append(
    "offset",
    String(
      Math.max(offset, 0)
    )
  );

  params.append(
    "order[chapter]",
    "asc"
  );

  const result =
    await mangaDexFetch(
      `/manga/${mangaId}/feed?${params.toString()}`
    );

  return {
    total: Number(
      result.total ?? 0
    ),

    offset: Number(
      result.offset ?? offset
    ),

    limit: Number(
      result.limit ?? limit
    ),

    chapters:
      (result.data || []).map(
        (chapter: MangaDexChapterRecord) => ({
          id: chapter.id,

          chapter:
            chapter.attributes
              ?.chapter ??
            null,

          title:
            chapter.attributes
              ?.title ??
            "",

          language:
            chapter.attributes
              ?.translatedLanguage ??
            "",

          pages:
            chapter.attributes
              ?.pages ??
            0,

          volume:
            chapter.attributes
              ?.volume ??
            null,
        })
      ),
  };
}

/*
 * جلب الفصول من جميع اللغات
 */
export async function getMangaChaptersAllLanguages(
  mangaId: string,
  limit: number = 100,
  offset: number = 0
) {
  const params =
    new URLSearchParams();

  params.append(
    "limit",
    String(
      Math.min(limit, 100)
    )
  );

  params.append(
    "offset",
    String(
      Math.max(offset, 0)
    )
  );

  params.append(
    "order[chapter]",
    "asc"
  );

  const result =
    await mangaDexFetch(
      `/manga/${mangaId}/feed?${params.toString()}`
    );

  return {
    total: Number(
      result.total ?? 0
    ),

    offset: Number(
      result.offset ?? offset
    ),

    limit: Number(
      result.limit ?? limit
    ),

    chapters:
      (result.data || []).map(
        (chapter: MangaDexChapterRecord) => ({
          id: chapter.id,

          chapter:
            chapter.attributes
              ?.chapter ??
            null,

          title:
            chapter.attributes
              ?.title ??
            "",

          language:
            chapter.attributes
              ?.translatedLanguage ??
            "",

          pages:
            chapter.attributes
              ?.pages ??
            0,

          volume:
            chapter.attributes
              ?.volume ??
            null,
        })
      ),
  };
}

/*
 * اختيار اللغة تلقائيًا
 *
 * العربية أولًا.
 * إذا لم توجد العربية،
 * يتم اختيار اللغة الأكثر توفرًا.
 */
export async function getMangaPreferredLanguage(
  mangaId: string
) {
  const arabic =
    await getMangaChapters(
      mangaId,
      "ar",
      1,
      0
    );

  if (arabic.total > 0) {
    return {
      language: "ar",
      total: arabic.total,
    };
  }

  const english =
    await getMangaChapters(
      mangaId,
      "en",
      1,
      0
    );

  if (english.total > 0) {
    return {
      language: "en",
      total: english.total,
    };
  }

  const allLanguages =
    await getMangaChaptersAllLanguages(
      mangaId,
      100,
      0
    );

  if (
    !allLanguages.chapters.length
  ) {
    return {
      language: null,
      total: 0,
    };
  }

  const languageCounts:
    Record<string, number> = {};

  for (
    const chapter of
      allLanguages.chapters
  ) {
    const chapterLanguage =
      chapter.language;

    if (!chapterLanguage) {
      continue;
    }

    languageCounts[
      chapterLanguage
    ] =
      (languageCounts[
        chapterLanguage
      ] || 0) + 1;
  }

  const preferredLanguage =
    Object.entries(
      languageCounts
    ).sort(
      (a, b) => b[1] - a[1]
    )[0];

  if (!preferredLanguage) {
    return {
      language: null,
      total: 0,
    };
  }

  const [
    language,
    count,
  ] = preferredLanguage;

  const languageChapters =
    await getMangaChapters(
      mangaId,
      language,
      1,
      0
    );

  return {
    language,

    total:
      languageChapters.total ||
      count,
  };
}

/*
 * جلب معلومات فصل واحد
 */
export async function getChapterInfo(
  chapterId: string
) {
  const result =
    await mangaDexFetch(
      `/chapter/${chapterId}?includes%5B%5D=scanlation_group`
    );

  const chapterData =
    result.data as MangaDexChapterRecord | undefined;

  const attributes =
    chapterData?.attributes ||
    {};

  const scanlationGroups =
    (chapterData?.relationships || [])
      .filter(
        (relationship) =>
          relationship.type === "scanlation_group" &&
          Boolean(relationship.attributes?.name)
      )
      .map((relationship) => ({
        id: relationship.id,
        name: relationship.attributes!.name!,
      }));

  return {
    id:
      chapterData?.id ||
      chapterId,

    chapter:
      attributes.chapter ??
      null,

    title:
      attributes.title ??
      null,

    language:
      attributes
        .translatedLanguage ??
      "",

    scanlationGroups,
  };
}

/*
 * جلب روابط صفحات الفصل
 */
export async function getMangaDexChapterPages(
  chapterId: string
): Promise<MangaDexChapterPage[]> {
  const result =
    await mangaDexFetch(
      `/at-home/server/${chapterId}`
    );

  const baseUrl =
    result.baseUrl;

  const hash =
    result.chapter?.hash;

  const fullQualityFilenames =
    result.chapter?.data;

  const dataSaverFilenames =
    result.chapter?.dataSaver;

  const hasFullQualityPages =
    Array.isArray(
      fullQualityFilenames
    ) &&
    fullQualityFilenames.length > 0;

  const hasDataSaverPages =
    Array.isArray(
      dataSaverFilenames
    ) &&
    dataSaverFilenames.length > 0;

  if (!baseUrl || !hash) {
    throw new Error(
      `لم يرسل MangaDex رابط صفحات صالحًا للفصل ${chapterId}.`
    );
  }

  if (
    !hasFullQualityPages &&
    !hasDataSaverPages
  ) {
    throw new Error(
      `MangaDex لم يرسل أسماء صور للفصل ${chapterId}؛ لا توجد صفحات متاحة لهذا الفصل حاليًا.`
    );
  }

  const filenames =
    hasFullQualityPages
      ? fullQualityFilenames
      : dataSaverFilenames;

  const imagePath =
    hasFullQualityPages
      ? "data"
      : "data-saver";

  return filenames.map(
    (
      filename: string,
      index: number
    ) => ({
      page_number:
        index + 1,

      filename,

      image_url:
        `${baseUrl}/${imagePath}/${hash}/${filename}`,
    })
  );
}
