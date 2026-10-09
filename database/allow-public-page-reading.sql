-- Public manga readers need to read page records from the pages table.
-- This grants SELECT only; it does not grant insert, update, or delete access.
GRANT SELECT ON TABLE public.pages TO anon, authenticated;

DROP POLICY IF EXISTS "al_titize_public_page_read" ON public.pages;

CREATE POLICY "al_titize_public_page_read"
ON public.pages
FOR SELECT
TO anon, authenticated
USING (true);
