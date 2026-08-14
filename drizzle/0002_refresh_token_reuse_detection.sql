ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" text;
ALTER TABLE "refresh_tokens" ADD COLUMN "consumed_at" integer;
ALTER TABLE "refresh_tokens" ADD COLUMN "revoked_at" integer;

CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens" ("family_id");
