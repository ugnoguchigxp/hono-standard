CREATE TABLE "health_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"alert_key" text NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"metric_name" text,
	"current_value" double precision,
	"threshold_value" double precision,
	"goal_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"detected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_health_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"report_key" text NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"steps_total" integer DEFAULT 0 NOT NULL,
	"avg_steps" double precision DEFAULT 0 NOT NULL,
	"activity_calories_total" integer DEFAULT 0 NOT NULL,
	"meal_count" integer DEFAULT 0 NOT NULL,
	"meal_calories_total" integer DEFAULT 0 NOT NULL,
	"meal_calories_average" double precision,
	"avg_systolic" double precision,
	"avg_diastolic" double precision,
	"blood_pressure_sample_count" integer DEFAULT 0 NOT NULL,
	"avg_fasting_glucose" double precision,
	"avg_postprandial_glucose" double precision,
	"blood_glucose_sample_count" integer DEFAULT 0 NOT NULL,
	"goal_count" integer DEFAULT 0 NOT NULL,
	"goal_achievement_rate_average" double precision,
	"previous_week_steps_total" integer DEFAULT 0 NOT NULL,
	"steps_delta" integer DEFAULT 0 NOT NULL,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "reminder_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"reminder_type" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"local_time" text DEFAULT '08:00' NOT NULL,
	"days_of_week" text DEFAULT 'monday,tuesday,wednesday,thursday,friday' NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"memo" text
);
--> statement-breakpoint
ALTER TABLE "health_alerts" ADD CONSTRAINT "health_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "health_alerts" ADD CONSTRAINT "health_alerts_goal_id_health_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."health_goals"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "weekly_health_reports" ADD CONSTRAINT "weekly_health_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reminder_settings" ADD CONSTRAINT "reminder_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ha_user_alert_key_uidx" ON "health_alerts" USING btree ("user_id","alert_key");
--> statement-breakpoint
CREATE INDEX "ha_user_unread_idx" ON "health_alerts" USING btree ("user_id","is_read");
--> statement-breakpoint
CREATE INDEX "ha_user_detected_idx" ON "health_alerts" USING btree ("user_id","detected_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "whr_user_report_key_uidx" ON "weekly_health_reports" USING btree ("user_id","report_key");
--> statement-breakpoint
CREATE INDEX "whr_user_week_idx" ON "weekly_health_reports" USING btree ("user_id","week_start");
--> statement-breakpoint
CREATE INDEX "whr_user_generated_idx" ON "weekly_health_reports" USING btree ("user_id","generated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "rs_user_reminder_type_uidx" ON "reminder_settings" USING btree ("user_id","reminder_type");
--> statement-breakpoint
CREATE INDEX "rs_user_enabled_idx" ON "reminder_settings" USING btree ("user_id","is_enabled");
