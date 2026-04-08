ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "age" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "height_cm" double precision;
