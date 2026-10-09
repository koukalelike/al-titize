-- Optional metadata fields used by the AniList enrichment layer.
ALTER TABLE public.manga
  ADD COLUMN IF NOT EXISTS anilist_id bigint,
  ADD COLUMN IF NOT EXISTS genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS average_score integer,
  ADD COLUMN IF NOT EXISTS metadata_source text NOT NULL DEFAULT 'mangadex';

CREATE INDEX IF NOT EXISTS manga_anilist_id_idx
  ON public.manga (anilist_id)
  WHERE anilist_id IS NOT NULL;
