-- Persist MediaObject ownership for new post attachments. Legacy post_media rows
-- retain media_url for backwards compatibility while all newly-created uploads
-- use the private media_objects lifecycle.
ALTER TABLE "post_media"
  ADD COLUMN IF NOT EXISTS "media_object_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "post_media_media_object_id_key"
  ON "post_media" ("media_object_id");

ALTER TABLE "post_media"
  ADD CONSTRAINT "post_media_media_object_id_fkey"
  FOREIGN KEY ("media_object_id") REFERENCES "media_objects"("id")
  ON DELETE SET NULL;
