PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "game_saves" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"game_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"revision" integer NOT NULL CHECK ("revision" > 0),
	"content_version" text NOT NULL,
	"state_revision" integer NOT NULL CHECK ("state_revision" >= 0),
	"saved_at" text NOT NULL,
	"save_json" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "game_saves_owner_slot_idx"
	ON "game_saves" ("user_id", "game_id", "slot_id");
CREATE INDEX IF NOT EXISTS "game_saves_user_id_idx" ON "game_saves" ("user_id");
CREATE INDEX IF NOT EXISTS "game_saves_updated_at_idx" ON "game_saves" ("updated_at");

CREATE TABLE IF NOT EXISTS "game_save_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"game_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"result_revision" integer NOT NULL CHECK ("result_revision" > 0),
	"result_save_json" text NOT NULL,
	"result_updated_at" text NOT NULL,
	"created_at" integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "game_save_operations_idempotency_idx"
	ON "game_save_operations" ("user_id", "game_id", "slot_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "game_save_operations_user_created_at_idx"
	ON "game_save_operations" ("user_id", "created_at");
