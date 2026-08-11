PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "game_save_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"game_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"revision" integer NOT NULL CHECK ("revision" > 0),
	"content_version" text NOT NULL,
	"state_revision" integer NOT NULL CHECK ("state_revision" >= 0),
	"saved_at" text NOT NULL,
	"save_json" text NOT NULL,
	"checksum" text NOT NULL,
	"created_at" integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "game_save_versions_owner_slot_revision_idx"
	ON "game_save_versions" ("user_id", "game_id", "slot_id", "revision");
CREATE INDEX IF NOT EXISTS "game_save_versions_owner_slot_created_idx"
	ON "game_save_versions" ("user_id", "game_id", "slot_id", "created_at");

INSERT OR IGNORE INTO "game_save_versions" (
	"id", "user_id", "game_id", "slot_id", "revision", "content_version",
	"state_revision", "saved_at", "save_json", "checksum", "created_at"
)
SELECT
	'backfill-' || "id", "user_id", "game_id", "slot_id", "revision",
	"content_version", "state_revision", "saved_at", "save_json",
	'legacy:' || "id", "updated_at"
FROM "game_saves";
