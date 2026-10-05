const MANGADEX_API = "https://api.mangadex.org";

export function getMangaId(input: string): string | null {
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

/*
 * جلب معلومات المانجا
 */
export async function getMangaInfo(input: string) {
  const mangaId = getMangaId(input);

  if (!mangaId) {
    throw new Error(
      "رابط MangaDex أو Manga ID غير صحيح"
    );
  }

  const response = await fetch(
    `${MANGADEX_API}/manga/${mangaId}?includes[]=cover_art`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `MangaDex API error: ${response.status}`
    );
  }

  const result = await response.json();

  const mangaData = result.data;

  /*
   * استخراج علاقة الغلاف cover_art
   */
  const coverRelationship =
    mangaData?.relationships?.find(
      (relationship: any) =>
        relationship.type === "cover_art"
    );

  /*
   * استخراج اسم ملف الغلاف
   */
  const fileName =
    coverRelationship?.attributes?.fileName;

  /*
   * بناء رابط الغلاف النهائي
   */
  const coverUrl = fileName
    ? `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`
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
  const params = new URLSearchParams();

  params.append(
    "translatedLanguage[]",
    language
  );

  params.append(
    "limit",
    String(Math.min(limit, 100))
  );

  params.append(
    "offset",
    String(Math.max(offset, 0))
  );

  params.append(
    "order[chapter]",
    "asc"
  );

  const response = await fetch(
    `${MANGADEX_API}/manga/${mangaId}/feed?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `MangaDex Chapter API error: ${response.status}`
    );
  }

  const result = await response.json();

  return {
    total: Number(result.total ?? 0),
    offset: Number(
      result.offset ?? offset
    ),
    limit: Number(
      result.limit ?? limit
    ),
    chapters: (result.data || []).map(
      (chapter: any) => ({
        id: chapter.id,
        chapter:
          chapter.attributes?.chapter ??
          null,
        title:
          chapter.attributes?.title ??
          "",
        language:
          chapter.attributes
            ?.translatedLanguage ??
          "",
        pages:
          chapter.attributes?.pages ??
          0,
        volume:
          chapter.attributes?.volume ??
          null,
      })
    ),
  };
}

/*
 * جلب الفصول من جميع اللغات
 *
 * نستخدمها فقط إذا لم نجد العربية.
 */
export async function getMangaChaptersAllLanguages(
  mangaId: string,
  limit: number = 100,
  offset: number = 0
) {
  const params = new URLSearchParams();

  params.append(
    "limit",
    String(Math.min(limit, 100))
  );

  params.append(
    "offset",
    String(Math.max(offset, 0))
  );

  params.append(
    "order[chapter]",
    "asc"
  );

  const response = await fetch(
    `${MANGADEX_API}/manga/${mangaId}/feed?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `MangaDex Chapter API error: ${response.status}`
    );
  }

  const result = await response.json();

  return {
    total: Number(result.total ?? 0),
    offset: Number(
      result.offset ?? offset
    ),
    limit: Number(
      result.limit ?? limit
    ),
    chapters: (result.data || []).map(
      (chapter: any) => ({
        id: chapter.id,
        chapter:
          chapter.attributes?.chapter ??
          null,
        title:
          chapter.attributes?.title ??
          "",
        language:
          chapter.attributes
            ?.translatedLanguage ??
          "",
        pages:
          chapter.attributes?.pages ??
          0,
        volume:
          chapter.attributes?.volume ??
          null,
      })
    ),
  };
}

/*
 * اختيار اللغة تلقائيًا
 *
 * الأولوية:
 *
 * 1. العربية
 * 2. إذا لم توجد العربية:
 *    نبحث عن اللغات المتوفرة
 *    ونختار اللغة التي لديها أكبر عدد
 *    من الفصول في النتيجة.
 */
export async function getMangaPreferredLanguage(
  mangaId: string
) {
  /*
   * أولاً: البحث عن العربية
   */
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

  /*
   * العربية غير موجودة.
   * نبحث عن اللغات الأخرى.
   */
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

  /*
   * حساب عدد الفصول لكل لغة.
   */
  const languageCounts: Record<
    string,
    number
  > = {};

  for (const chapter of allLanguages.chapters) {
    const chapterLanguage =
      chapter.language;

    if (!chapterLanguage) {
      continue;
    }

    languageCounts[chapterLanguage] =
      (languageCounts[chapterLanguage] ||
        0) + 1;
  }

  /*
   * اختيار اللغة التي لديها
   * أكبر عدد من الفصول.
   */
  const preferredLanguage =
    Object.entries(languageCounts).sort(
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

  /*
   * نحاول معرفة العدد الحقيقي
   * للفصول في اللغة المختارة.
   */
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
      languageChapters.total || count,
  };
}

/*
 * جلب معلومات فصل واحد من MangaDex
 */
export async function getChapterInfo(
  chapterId: string
) {
  const response = await fetch(
    `${MANGADEX_API}/chapter/${chapterId}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `MangaDex Chapter API error: ${response.status}`
    );
  }

  const result =
    await response.json();

  const attributes =
    result.data?.attributes || {};

  return {
    id:
      result.data?.id ||
      chapterId,
    chapter:
      attributes.chapter ??
      null,
    title:
      attributes.title ??
      null,
    language:
      attributes.translatedLanguage ??
      "",
  };
}

/*
 * جلب روابط صفحات الفصل من MangaDex
 */
export async function getChapterPages(
  chapterId: string
) {
  const response = await fetch(
    `${MANGADEX_API}/at-home/server/${chapterId}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `MangaDex At-Home API error: ${response.status}`
    );
  }

  const result =
    await response.json();

  const baseUrl =
    result.baseUrl;

  const hash =
    result.chapter?.hash;

  const filenames =
    result.chapter?.data;

  if (
    !baseUrl ||
    !hash ||
    !Array.isArray(filenames) ||
    filenames.length === 0
  ) {
    throw new Error(
      "لم يتم العثور على صور لهذا الفصل."
    );
  }

  return filenames.map(
    (
      filename: string,
      index: number
    ) => ({
      page_number:
        index + 1,
      filename,
      image_url:
        `${baseUrl}/data/${hash}/${filename}`,
    })
  );
}