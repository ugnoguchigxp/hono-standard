CREATE TABLE "activity_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"external_id" text,
	"value_hash" text,
	"input_source" text DEFAULT 'manual' NOT NULL,
	"sync_source" text,
	"memo" text,
	"steps" integer,
	"active_minutes" integer,
	"calories_burned" integer
);
--> statement-breakpoint
CREATE TABLE "blood_glucose_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"external_id" text,
	"value_hash" text,
	"input_source" text DEFAULT 'manual' NOT NULL,
	"sync_source" text,
	"memo" text,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"timing" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blood_pressure_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"external_id" text,
	"value_hash" text,
	"input_source" text DEFAULT 'manual' NOT NULL,
	"sync_source" text,
	"memo" text,
	"systolic" integer NOT NULL,
	"diastolic" integer NOT NULL,
	"pulse" integer,
	"period" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_health_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"summary_date" date NOT NULL,
	"steps_total" integer DEFAULT 0 NOT NULL,
	"active_minutes_total" integer DEFAULT 0 NOT NULL,
	"activity_calories_total" integer DEFAULT 0 NOT NULL,
	"meal_count" integer DEFAULT 0 NOT NULL,
	"latest_bp_systolic" integer,
	"latest_bp_diastolic" integer,
	"latest_bp_pulse" integer,
	"latest_bp_recorded_at" timestamp,
	"latest_glucose_value" double precision,
	"latest_glucose_unit" text,
	"latest_glucose_recorded_at" timestamp,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_sync_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"last_synced_at" timestamp,
	"cursor" text,
	"status" text DEFAULT 'idle' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"external_id" text,
	"value_hash" text,
	"input_source" text DEFAULT 'manual' NOT NULL,
	"sync_source" text,
	"memo" text,
	"items" text NOT NULL,
	"estimated_calories" integer
);
--> statement-breakpoint
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_glucose_records" ADD CONSTRAINT "blood_glucose_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_pressure_records" ADD CONSTRAINT "blood_pressure_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_health_summaries" ADD CONSTRAINT "daily_health_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_sync_states" ADD CONSTRAINT "health_sync_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_records" ADD CONSTRAINT "meal_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ar_user_recorded_idx" ON "activity_records" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ar_user_external_id_uidx" ON "activity_records" USING btree ("user_id","external_id") WHERE "activity_records"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ar_user_value_hash_uidx" ON "activity_records" USING btree ("user_id","value_hash") WHERE "activity_records"."value_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "bgr_user_recorded_idx" ON "blood_glucose_records" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bgr_user_external_id_uidx" ON "blood_glucose_records" USING btree ("user_id","external_id") WHERE "blood_glucose_records"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bgr_user_value_hash_uidx" ON "blood_glucose_records" USING btree ("user_id","value_hash") WHERE "blood_glucose_records"."value_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "bpr_user_recorded_idx" ON "blood_pressure_records" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bpr_user_external_id_uidx" ON "blood_pressure_records" USING btree ("user_id","external_id") WHERE "blood_pressure_records"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bpr_user_value_hash_uidx" ON "blood_pressure_records" USING btree ("user_id","value_hash") WHERE "blood_pressure_records"."value_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "dhs_user_date_uidx" ON "daily_health_summaries" USING btree ("user_id","summary_date");--> statement-breakpoint
CREATE INDEX "dhs_user_date_idx" ON "daily_health_summaries" USING btree ("user_id","summary_date");--> statement-breakpoint
CREATE UNIQUE INDEX "hss_user_provider_uidx" ON "health_sync_states" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "hss_user_id_idx" ON "health_sync_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mr_user_recorded_idx" ON "meal_records" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mr_user_external_id_uidx" ON "meal_records" USING btree ("user_id","external_id") WHERE "meal_records"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mr_user_value_hash_uidx" ON "meal_records" USING btree ("user_id","value_hash") WHERE "meal_records"."value_hash" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;