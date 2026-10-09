import type { NormalizedMangaMetadata } from "@/lib/data-sources/types";

const ANILIST_API = "https://graphql.anilist.co";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 2_100;
const MAX_CACHE_ENTRIES = 250;

type AniListTitle = {
  romaji: string | null;
  english: string | null;
  native: string | null;
  userPreferred: string | null;
};

type AniListMedia = {
  id: number;
  title: AniListTitle;
  synonyms: string[];
  description: string | null;
  status: string | null;
  averageScore: number | null;
  genres: string[];
  coverImage: {
    extraLarge: string | null;
    large: string | null;
    medium: string | null;
  } | null;
  siteUrl: string | null;
};

type AniListResponse = {
  data?: {
    Page?: { media?: AniListMedia[] };
    Media?: AniListMedia | null;
  };
  errors?: Array<{ message?: string }>;
};

const SEARCH_QUERY = `
  query SearchManga($search: String!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: MANGA, isAdult: false) {
        id
        title { romaji english native userPreferred }
        synonyms
        description(asHtml: false)
        status
        averageScore
        genres
        coverImage { extraLarge large medium }
        siteUrl
      }
    }
  }
`;

const BY_ID_QUERY = `
  query MangaById($id: Int!) {
    Media(id: $id, type: MANGA) {
      id
      title { romaji english native userPreferred }
      synonyms
      description(asHtml: false)
      status
      averageScore
      genres
      coverImage { extraLarge large medium }
      siteUrl
    }
  }
`;

const cache = new Map<string, { expiresAt: number; value: AniListMedia[] }>();
const inFlight = new Map<string, Promise<AniListMedia[]>>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function queueRequest<T>(request: () => Promise<T>): Promise<T> {
  const queued = requestQueue.then(async () => {
    const waitMs = Math.max(
      0,
      MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt)
    );

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    lastRequestAt = Date.now();
    return request();
  });

  requestQueue = queued.then(
    () => undefined,
    () => undefined
  );

  return queued;
}

async function queryAniList(
  key: string,
  query: string,
  variables: Record<string, string | number>
): Promise<AniListMedia[]> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const activeRequest = inFlight.get(key);
  if (activeRequest) {
    return activeRequest;
  }

  const request = queueRequest(async () => {
    const response = await fetch(ANILIST_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    const result = (await response.json()) as AniListResponse;

    if (!response.ok || result.errors?.length) {
      const detail = result.errors?.[0]?.message;
      const retryAfter = response.headers.get("retry-after");
      throw new Error(
        detail ||
          (response.status === 429
            ? `AniList is rate limiting requests. Retry after ${retryAfter ?? "a short wait"}.`
            : `AniList request failed (${response.status}).`)
      );
    }

    const value = result.data?.Page?.media ??
      (result.data?.Media ? [result.data.Media] : []);

    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }

    return value;
  });

  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    inFlight.delete(key);
  }
}

export async function searchAniListManga(
  search: string,
  perPage = 8
): Promise<AniListMedia[]> {
  const normalizedSearch = search.trim().replace(/\s+/g, " ").slice(0, 100);
  if (normalizedSearch.length < 2) return [];

  const safePerPage = Math.max(1, Math.min(Math.trunc(perPage), 10));
  const key = `search:${normalizedSearch.toLowerCase()}:${safePerPage}`;

  return queryAniList(key, SEARCH_QUERY, {
    search: normalizedSearch,
    page: 1,
    perPage: safePerPage,
  });
}

export async function getAniListMangaById(id: number): Promise<AniListMedia | null> {
  if (!Number.isInteger(id) || id < 1) return null;

  const results = await queryAniList(`id:${id}`, BY_ID_QUERY, { id });
  return results[0] ?? null;
}

export function normalizeAniListManga(media: AniListMedia): NormalizedMangaMetadata {
  const title =
    media.title.english ||
    media.title.userPreferred ||
    media.title.romaji ||
    media.title.native ||
    "بدون عنوان";

  const status =
    media.status === "FINISHED"
      ? "completed"
      : media.status === "HIATUS"
        ? "hiatus"
        : media.status === "CANCELLED"
          ? "cancelled"
          : "ongoing";

  return {
    title,
    description: media.description?.trim() || null,
    status,
    genres: media.genres ?? [],
    averageScore: media.averageScore ?? null,
    coverUrl:
      media.coverImage?.extraLarge ??
      media.coverImage?.large ??
      media.coverImage?.medium ??
      null,
    source: "anilist",
    sourceIds: { anilist: media.id, mangadex: null },
    siteUrl: media.siteUrl ?? null,
  };
}

export function findAniListTitleMatch(
  mangaDexTitles: string[],
  candidates: AniListMedia[]
): AniListMedia | null {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "");

  const wantedTitles = new Set(
    mangaDexTitles.map(normalize).filter(Boolean)
  );

  if (wantedTitles.size === 0) return null;

  return (
    candidates.find((candidate) => {
      const candidateTitles = [
        candidate.title.english,
        candidate.title.userPreferred,
        candidate.title.romaji,
        candidate.title.native,
        ...(candidate.synonyms ?? []),
      ]
        .filter((title): title is string => Boolean(title))
        .map(normalize);

      return candidateTitles.some((title) => wantedTitles.has(title));
    }) ?? null
  );
}
