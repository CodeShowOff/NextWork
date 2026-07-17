-- Link new message attachments to their scanned private MediaObject. Existing rows remain compatible.
ALTER TABLE "message_attachments"
  ADD COLUMN IF NOT EXISTS "media_object_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "message_attachments_media_object_id_key"
  ON "message_attachments" ("media_object_id")
  WHERE "media_object_id" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_media_object_id_fkey'
  ) THEN
    ALTER TABLE "message_attachments"
      ADD CONSTRAINT "message_attachments_media_object_id_fkey"
      FOREIGN KEY ("media_object_id") REFERENCES "media_objects"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
