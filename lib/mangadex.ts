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

export async function getMangaInfo(input: string) {
  const mangaId = getMangaId(input);

  if (!mangaId) {
    throw new Error("رابط MangaDex أو Manga ID غير صحيح");
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

  return {
    id: mangaId,
    data: result.data,
  };
}

export async function getMangaChapters(
  mangaId: string,
  language: string = "ar",
  limit: number = 100,
  offset: number = 0
) {
  const params = new URLSearchParams();

  params.append("translatedLanguage[]", language);
  params.append(
    "limit",
    String(Math.min(limit, 100))
  );
  params.append(
    "offset",
    String(Math.max(offset, 0))
  );
  params.append("order[chapter]", "asc");

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
    offset: Number(result.offset ?? offset),
    limit: Number(result.limit ?? limit),
    chapters: (result.data || []).map(
      (chapter: any) => ({
        id: chapter.id,
        chapter:
          chapter.attributes?.chapter ?? null,
        title:
          chapter.attributes?.title ?? "",
        language:
          chapter.attributes?.translatedLanguage ?? "",
        pages:
          chapter.attributes?.pages ?? 0,
        volume:
          chapter.attributes?.volume ?? null,
      })
    ),
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

  const result = await response.json();

  const attributes =
    result.data?.attributes || {};

  return {
    id: result.data?.id || chapterId,
    chapter:
      attributes.chapter ?? null,
    title:
      attributes.title ?? null,
    language:
      attributes.translatedLanguage ?? "",
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

  const result = await response.json();

  const baseUrl = result.baseUrl;
  const hash = result.chapter?.hash;
  const filenames = result.chapter?.data;

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
    (filename: string, index: number) => ({
      page_number: index + 1,
      filename,
      image_url:
        `${baseUrl}/data/${hash}/${filename}`,
    })
  );
}