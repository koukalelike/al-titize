import type { NormalizedChapterPage } from "@/lib/data-sources/types";

const DEFAULT_API_URL = "https://api.consumet.org";
const DEFAULT_MANGA_PROVIDERS = [
  "mangapill",
  "mangahere",
  "mangakakalot",
  "managreader",
];
const REQUEST_TIMEOUT_MS = 15_000;

type JsonRecord = Record<string, unknown>;

class ConsumetHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ConsumetHttpError";
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function getProviderNames(): string[] {
  const configured = process.env.CONSUMET_MANGA_PROVIDERS
    ?.split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => /^[a-z0-9-]+$/.test(provider));

  return configured?.length ? [...new Set(configured)] : DEFAULT_MANGA_PROVIDERS;
}

function getBaseUrl(): string {
  const value = process.env.CONSUMET_API_URL?.trim() || DEFAULT_API_URL;
  const parsed = new URL(value);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("CONSUMET_API_URL يجب أن يبدأ بـ http:// أو https://.");
  }

  return value.replace(/\/+$/, "");
}

async function fetchConsumetJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AL-TITIZE/0.1.0",
      },
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const record = asRecord(payload);
      const message =
        asText(record?.message) ??
        asText(record?.error) ??
        `HTTP ${response.status}`;
      throw new ConsumetHttpError(`Consumet: ${message}`, response.status);
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("انتهت مهلة الاتصال بخادم Consumet.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getRecords(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter((item): item is JsonRecord => item !== null);
  }

  const record = asRecord(payload);
  const nested = asRecord(record?.data);
  const candidates = [
    record?.results,
    record?.chapters,
    record?.pages,
    record?.data,
    nested?.results,
    nested?.chapters,
    nested?.pages,
  ];
  const list = candidates.find(Array.isArray);

  return Array.isArray(list)
    ? list.map(asRecord).filter((item): item is JsonRecord => item !== null)
    : [];
}

function getInfoRecord(payload: unknown): JsonRecord | null {
  const record = asRecord(payload);
  if (!record) return null;

  return asRecord(record.data) ?? asRecord(record.result) ?? record;
}

function getTitles(record: JsonRecord): string[] {
  const titles = [record.title, record.name, record.mangaTitle]
    .map(asText)
    .filter((title): title is string => title !== null);
  const alternatives = record.alternativeTitles ?? record.altTitles;

  if (Array.isArray(alternatives)) {
    titles.push(
      ...alternatives
        .map(asText)
        .filter((title): title is string => title !== null)
    );
  }

  return titles;
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isTitleMatch(target: string, candidate: JsonRecord): boolean {
  const normalizedTarget = normalizeTitle(target);
  if (!normalizedTarget) return false;

  return getTitles(candidate).some((title) => {
    const normalizedCandidate = normalizeTitle(title);
    if (normalizedCandidate === normalizedTarget) return true;

    const shorter = Math.min(normalizedCandidate.length, normalizedTarget.length);
    const longer = Math.max(normalizedCandidate.length, normalizedTarget.length);
    return (
      shorter >= 8 &&
      longer > 0 &&
      shorter / longer >= 0.88 &&
      (normalizedCandidate.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedCandidate))
    );
  });
}

function getChapterNumber(record: JsonRecord): number | null {
  const value =
    record.chapterNumber ?? record.chapter ?? record.number ?? record.chapter_number;

  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = asText(value) ?? asText(record.title) ?? asText(record.name);
  if (!text) return null;

  const match =
    text.match(/(?:chapter|chap\.?|ch\.?)[\s:#-]*(-?\d+(?:\.\d+)?)/i) ??
    text.match(/^\s*(-?\d+(?:\.\d+)?)(?:\s|$)/);

  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getImageUrl(record: JsonRecord): string | null {
  const candidate =
    asText(record.img) ??
    asText(record.image) ??
    asText(record.imageUrl) ??
    asText(record.image_url) ??
    asText(record.url) ??
    asText(record.src);

  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password ||
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".local") ||
      /^(127\.|10\.|192\.168\.|169\.254\.)/.test(parsed.hostname)
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function getPageHeaders(record: JsonRecord): Record<string, string> | undefined {
  const source = asRecord(record.headers);
  if (!source) return undefined;

  const headers: Record<string, string> = {};
  for (const key of ["referer", "origin", "user-agent", "accept"]) {
    const capitalized = key
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join("-");
    const value = asText(source[key] ?? source[capitalized]);
    if (value && value.length <= 500) headers[capitalized] = value;
  }

  return Object.keys(headers).length ? headers : undefined;
}

function findChapter(
  chapters: JsonRecord[],
  wantedChapterNumber: string | null
): JsonRecord | null {
  if (!wantedChapterNumber) return null;
  const wantedNumber = Number(wantedChapterNumber);
  if (!Number.isFinite(wantedNumber)) return null;

  return (
    chapters.find((chapter) => {
      const chapterLanguage =
        asText(chapter.language) ??
        asText(chapter.translatedLanguage) ??
        asText(chapter.lang);

      if (chapterLanguage && !chapterLanguage.toLowerCase().startsWith("en")) {
        return false;
      }

      const foundNumber = getChapterNumber(chapter);
      return foundNumber !== null && Math.abs(foundNumber - wantedNumber) < 0.0001;
    }) ?? null
  );
}

function getPages(payload: unknown): NormalizedChapterPage[] {
  const records = getRecords(payload);
  const pageValues = records
    .map((record, index) => {
      const numberValue = record.pageNumber ?? record.page ?? record.number;
      const pageNumber =
        typeof numberValue === "number"
          ? numberValue
          : typeof numberValue === "string" && numberValue.trim()
            ? Number(numberValue)
            : Number.NaN;

      return { record, index, url: getImageUrl(record), number: pageNumber };
    })
    .filter(
      (item): item is typeof item & { url: string } => item.url !== null
    );

  const isZeroIndexed = pageValues.some((item) => item.number === 0);

  return pageValues
    .map(({ record, index, url, number }) => {
      const pageNumber = Number.isFinite(number)
        ? number + (isZeroIndexed ? 1 : 0)
        : index + 1;
      const pathname = new URL(url).pathname;
      const filename = decodeURIComponent(
        pathname.split("/").pop() || `page-${pageNumber}.jpg`
      );

      return {
        page_number: pageNumber,
        filename,
        image_url: url,
        source: "consumet" as const,
        headers: getPageHeaders(record),
      };
    })
    .sort((a, b) => a.page_number - b.page_number);
}

function buildPath(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("/");
}

export async function getConsumetChapterPages(input: {
  mangaDexId: string;
  mangaTitle: string;
  chapterNumber: string | null;
  language: string;
}): Promise<NormalizedChapterPage[] | null> {
  if (!input.chapterNumber || !input.mangaTitle.trim()) return null;

  // These default Consumet manga providers are English-language sources.
  // Do not replace an Arabic (or other language) chapter with another translation.
  if (!input.language.toLowerCase().startsWith("en")) return null;

  const providers = getProviderNames();
  let lastProviderError: string | null = null;

  for (const provider of providers) {
    try {
      const searchPayload = await fetchConsumetJson(
        `/${buildPath("manga", provider, input.mangaTitle)}`
      );
      const mangaResult = getRecords(searchPayload).find((item) =>
        isTitleMatch(input.mangaTitle, item)
      );
      const mangaId = asText(mangaResult?.id);
      if (!mangaResult || !mangaId) continue;

      const infoPayload = await fetchConsumetJson(
        `/${buildPath("manga", provider, "info", mangaId)}`
      );
      const info = getInfoRecord(infoPayload);
      const chapters = getRecords(info?.chapters ?? infoPayload);
      const matchingChapter = findChapter(chapters, input.chapterNumber);
      const chapterId = asText(matchingChapter?.id);
      if (!chapterId) continue;

      const pagesPayload = await fetchConsumetJson(
        `/${buildPath("manga", provider, "read", chapterId)}`
      );
      const pages = getPages(pagesPayload);
      if (pages.length) return pages;
    } catch (error) {
      lastProviderError =
        error instanceof Error ? error.message : "تعذر الاتصال بالمصدر.";

      // Authentication, regional/legal blocks, and network failures affect the whole API host.
      if (
        (error instanceof ConsumetHttpError &&
          [401, 403, 451].includes(error.status)) ||
        error instanceof TypeError ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        break;
      }
    }
  }

  if (lastProviderError) {
    throw new Error(
      `لم يتمكن Consumet من جلب الفصل. تحقق من اتصال API ومزوديه: ${lastProviderError}`
    );
  }

  return null;
}
