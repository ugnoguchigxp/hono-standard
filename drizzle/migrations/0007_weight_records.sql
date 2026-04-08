CREATE TABLE "weight_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"external_id" text,
	"value_hash" text,
	"input_source" text DEFAULT 'manual' NOT NULL,
	"sync_source" text,
	"memo" text,
	"value" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weight_records" ADD CONSTRAINT "weight_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wr_user_recorded_idx" ON "weight_records" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wr_user_external_id_uidx" ON "weight_records" USING btree ("user_id","external_id") WHERE "weight_records"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wr_user_value_hash_uidx" ON "weight_records" USING btree ("user_id","value_hash") WHERE "weight_records"."value_hash" IS NOT NULL;--> statement-breakpoint
