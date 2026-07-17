-- Group collaboration resources, role-based membership, media lifecycle, and profile skills.
-- The initial migration in this repository predates the Prisma schema, so this migration is
-- intentionally additive and safe to apply to databases created by earlier releases.

DO $$ BEGIN
  CREATE TYPE "GroupRole" AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GroupMembershipRequestStatus" AS ENUM ('pending', 'approved', 'declined', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GroupInvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MediaObjectStatus" AS ENUM ('pending_upload', 'scanning', 'available', 'quarantined', 'rejected', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GroupEventRsvpStatus" AS ENUM ('going', 'maybe', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LiveSessionStatus" AS ENUM ('active', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "groups"
  ADD COLUMN IF NOT EXISTS "group_type" TEXT NOT NULL DEFAULT 'Teams & Projects',
  ADD COLUMN IF NOT EXISTS "group_privacy" TEXT NOT NULL DEFAULT 'Open',
  ADD COLUMN IF NOT EXISTS "photo_url" TEXT;

ALTER TABLE "group_members"
  ADD COLUMN IF NOT EXISTS "role" "GroupRole" NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS "is_favorite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_visited_at" TIMESTAMPTZ;

-- Existing group creators become owners. Earlier groups with no creator retain member roles;
-- organization owner/admin retains its documented override authority.
UPDATE "group_members" AS membership
SET "role" = 'owner'
FROM "groups"
WHERE membership."group_id" = "groups"."id"
  AND membership."user_id" = "groups"."created_by"
  AND membership."role" = 'member';

CREATE TABLE IF NOT EXISTS "group_membership_requests" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "requester_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message" TEXT,
  "status" "GroupMembershipRequestStatus" NOT NULL DEFAULT 'pending',
  "resolved_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("group_id", "requester_id")
);
CREATE INDEX IF NOT EXISTS "group_membership_requests_group_id_status_created_at_idx"
  ON "group_membership_requests" ("group_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "group_membership_requests_requester_id_status_idx"
  ON "group_membership_requests" ("requester_id", "status");

CREATE TABLE IF NOT EXISTS "group_invitations" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "invited_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invited_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "GroupInvitationStatus" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("group_id", "invited_user_id")
);
CREATE INDEX IF NOT EXISTS "group_invitations_invited_user_id_status_created_at_idx"
  ON "group_invitations" ("invited_user_id", "status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "media_objects" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "owner_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "group_id" UUID REFERENCES "groups"("id") ON DELETE CASCADE,
  "storage_key" TEXT NOT NULL UNIQUE,
  "original_file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "status" "MediaObjectStatus" NOT NULL DEFAULT 'pending_upload',
  "scan_detail" TEXT,
  "uploaded_at" TIMESTAMPTZ,
  "available_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "media_objects_owner_id_status_created_at_idx"
  ON "media_objects" ("owner_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "media_objects_group_id_status_created_at_idx"
  ON "media_objects" ("group_id", "status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "group_files" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "media_object_id" UUID NOT NULL UNIQUE REFERENCES "media_objects"("id") ON DELETE CASCADE,
  "uploaded_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_files_group_id_created_at_idx"
  ON "group_files" ("group_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "group_albums" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "created_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_albums_group_id_created_at_idx"
  ON "group_albums" ("group_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "group_album_photos" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "album_id" UUID NOT NULL REFERENCES "group_albums"("id") ON DELETE CASCADE,
  "media_object_id" UUID NOT NULL UNIQUE REFERENCES "media_objects"("id") ON DELETE CASCADE,
  "uploaded_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "caption" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_album_photos_album_id_created_at_idx"
  ON "group_album_photos" ("album_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "group_events" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "created_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "starts_at" TIMESTAMPTZ NOT NULL,
  "ends_at" TIMESTAMPTZ,
  "timezone" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);
CREATE INDEX IF NOT EXISTS "group_events_group_id_starts_at_idx"
  ON "group_events" ("group_id", "starts_at");

CREATE TABLE IF NOT EXISTS "group_event_rsvps" (
  "event_id" UUID NOT NULL REFERENCES "group_events"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "GroupEventRsvpStatus" NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("event_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "group_event_rsvps_event_id_status_idx"
  ON "group_event_rsvps" ("event_id", "status");

CREATE TABLE IF NOT EXISTS "live_sessions" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "room_name" TEXT NOT NULL UNIQUE,
  "started_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ended_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "status" "LiveSessionStatus" NOT NULL DEFAULT 'active',
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ended_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "live_sessions_group_id_status_started_at_idx"
  ON "live_sessions" ("group_id", "status", "started_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "live_sessions_one_active_per_group"
  ON "live_sessions" ("group_id") WHERE "status" = 'active';

CREATE TABLE IF NOT EXISTS "profile_skills" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "profile_user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("profile_user_id", "normalized_name")
);
CREATE INDEX IF NOT EXISTS "profile_skills_normalized_name_idx"
  ON "profile_skills" ("normalized_name");
