-- Run this once in the Supabase SQL Editor.
-- Existing whole chapter numbers are preserved; decimal numbers such as 86.5
-- will also be accepted after this change.
ALTER TABLE public.chapters
ALTER COLUMN chapter_number TYPE numeric
USING chapter_number::numeric;
