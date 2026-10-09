# MangaDex attribution and removal requests

Newly imported MangaDex chapters store their MangaDex chapter UUID and the names/IDs of the scanlation groups returned by the API. The reader links to MangaDex and displays those groups. The admin chapter list also keeps the group information available while reviewing chapters.

Before importing more chapters, apply `database/mangadex-attribution-columns.sql` in the Supabase SQL Editor. To backfill old chapters, select them in the MangaDex import screen and import again; the site updates their source and group credits without uploading their pages again.

If an active scanlation group leader sends a written request to remove their work, use **Admin → Chapters** to identify the affected chapter by its group name and delete it. Deletion removes the chapter from the site and attempts to remove its page images from the `manga-pages` Storage bucket. If the page reports a Storage cleanup warning, review that chapter's files in Supabase Storage and remove them manually.

Keep MangaDex and scanlation-group attribution visible. Do not place ads or charge users for access to MangaDex-powered content.
