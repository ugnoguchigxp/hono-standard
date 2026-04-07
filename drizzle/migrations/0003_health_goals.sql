CREATE TABLE "health_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_type" text NOT NULL,
	"period" text DEFAULT 'daily' NOT NULL,
	"target_value" double precision,
	"target_min" double precision,
	"target_max" double precision,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"memo" text
);
--> statement-breakpoint
ALTER TABLE "health_goals" ADD CONSTRAINT "health_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "hg_user_active_idx" ON "health_goals" USING btree ("user_id","is_active");
--> statement-breakpoint
CREATE INDEX "hg_user_goal_type_idx" ON "health_goals" USING btree ("user_id","goal_type");
--> statement-breakpoint
CREATE INDEX "hg_user_starts_on_idx" ON "health_goals" USING btree ("user_id","starts_on");
--> statement-breakpoint
CREATE INDEX "hg_user_id_idx" ON "health_goals" USING btree ("user_id");
