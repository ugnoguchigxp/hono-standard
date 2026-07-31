ALTER TABLE "user_settings"
ADD COLUMN IF NOT EXISTS "instruction_locale" text NOT NULL DEFAULT 'ja-JP';
