ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" text;
ALTER TABLE "refresh_tokens" ADD COLUMN "consumed_at" timestamp with time zone;
ALTER TABLE "refresh_tokens" ADD COLUMN "revoked_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens" ("family_id");
