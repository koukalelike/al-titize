export type MangaMetadataSource = "anilist" | "mangadex";

export type NormalizedMangaMetadata = {
  title: string;
  description: string | null;
  status: "ongoing" | "completed" | "hiatus" | "cancelled";
  genres: string[];
  averageScore: number | null;
  coverUrl: string | null;
  source: MangaMetadataSource;
  sourceIds: {
    anilist: number | null;
    mangadex: string | null;
  };
  siteUrl: string | null;
};

export type NormalizedChapterPage = {
  page_number: number;
  filename: string;
  image_url: string;
  source: "mangadex" | "consumet";
  headers?: Record<string, string>;
};

export type LicensedChapterPageProvider = (input: {
  mangaDexId: string;
  mangaTitle: string;
  chapterNumber: string | null;
  language: string;
}) => Promise<NormalizedChapterPage[] | null>;
