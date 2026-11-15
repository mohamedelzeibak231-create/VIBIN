-- vibin: let the "videos" storage bucket accept photos as well as videos.
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run more than once.

update storage.buckets
set allowed_mime_types = null
where id = 'videos';
