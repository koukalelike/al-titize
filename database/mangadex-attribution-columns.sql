-- Apply this once in Supabase SQL Editor before importing more MangaDex chapters.
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS mangadex_chapter_id uuid,
  ADD COLUMN IF NOT EXISTS scanlation_groups jsonb NOT NULL DEFAULT '[]'::jsonb;
