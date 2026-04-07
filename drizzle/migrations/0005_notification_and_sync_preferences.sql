CREATE TABLE "notification_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"device_token" text NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "health_sync_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"interval_hours" integer DEFAULT 6 NOT NULL,
	"wifi_only" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp,
	"memo" text
);
--> statement-breakpoint
ALTER TABLE "notification_devices" ADD CONSTRAINT "notification_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "health_sync_preferences" ADD CONSTRAINT "health_sync_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "nd_user_platform_token_uidx" ON "notification_devices" USING btree ("user_id","platform","device_token");
--> statement-breakpoint
CREATE INDEX "nd_user_platform_idx" ON "notification_devices" USING btree ("user_id","platform");
--> statement-breakpoint
CREATE UNIQUE INDEX "hsp_user_id_uidx" ON "health_sync_preferences" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "hsp_user_enabled_idx" ON "health_sync_preferences" USING btree ("user_id","is_enabled");
