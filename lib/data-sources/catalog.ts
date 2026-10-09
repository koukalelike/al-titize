import {
  findAniListTitleMatch,
  normalizeAniListManga,
  searchAniListManga,
} from "@/lib/data-sources/anilist";
import type { NormalizedMangaMetadata } from "@/lib/data-sources/types";
import { getMangaInfo } from "@/lib/mangadex";

function normalizeMangaDexStatus(value: string | undefined): NormalizedMangaMetadata["status"] {
  if (value === "completed") return "completed";
  if (value === "hiatus") return "hiatus";
  if (value === "cancelled") return "cancelled";
  return "ongoing";
}

function getMangaDexText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const translations = value as Record<string, unknown>;
  const text = translations.en ?? Object.values(translations)[0];
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

export async function getUnifiedMangaMetadata(
  mangaDexId: string
): Promise<NormalizedMangaMetadata> {
  const mangaDex = await getMangaInfo(mangaDexId);
  const attributes = mangaDex.data?.attributes ?? {};
  const mangaDexTitleValues = Object.values(attributes.title ?? {}).filter(
    (value): value is string => typeof value === "string" && Boolean(value.trim())
  );
  const mangaDexFallback: NormalizedMangaMetadata = {
    title:
      attributes.title?.en ??
      mangaDexTitleValues[0] ??
      "بدون عنوان",
    description: getMangaDexText(attributes.description),
    status: normalizeMangaDexStatus(attributes.status),
    genres: [],
    averageScore: null,
    coverUrl: mangaDex.coverUrl,
    source: "mangadex",
    sourceIds: { anilist: null, mangadex: mangaDexId },
    siteUrl: `https://mangadex.org/title/${mangaDexId}`,
  };

  try {
    const searchTitle =
      attributes.title?.en ?? mangaDexTitleValues[0] ?? "";
    const candidates = await searchAniListManga(searchTitle);
    const match = findAniListTitleMatch(mangaDexTitleValues, candidates);

    if (!match) return mangaDexFallback;

    const metadata = normalizeAniListManga(match);
    return {
      ...metadata,
      description: metadata.description ?? mangaDexFallback.description,
      coverUrl: metadata.coverUrl ?? mangaDex.coverUrl,
      sourceIds: { anilist: match.id, mangadex: mangaDexId },
    };
  } catch {
    // AniList is an enrichment source; a temporary failure must not stop a MangaDex import.
    return mangaDexFallback;
  }
}
