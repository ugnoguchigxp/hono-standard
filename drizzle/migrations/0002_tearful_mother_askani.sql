CREATE TABLE "medical_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"interview_id" uuid NOT NULL,
	"primary_diagnosis" text NOT NULL,
	"confidence" double precision NOT NULL,
	"recommendations" text NOT NULL,
	"urgency_level" text DEFAULT 'LOW' NOT NULL,
	CONSTRAINT "medical_diagnoses_interview_id_unique" UNIQUE("interview_id")
);
--> statement-breakpoint
CREATE TABLE "medical_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"session_id" text NOT NULL,
	"patient_age" integer,
	"patient_gender" text,
	"status" text DEFAULT 'IN_PROGRESS' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "medical_interviews_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "medical_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"interview_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"answer_text" text,
	"question_order" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "uex_provider_ext_idx";--> statement-breakpoint
ALTER TABLE "medical_diagnoses" ADD CONSTRAINT "medical_diagnoses_interview_id_medical_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."medical_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_questions" ADD CONSTRAINT "medical_questions_interview_id_medical_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."medical_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mq_interview_id_idx" ON "medical_questions" USING btree ("interview_id");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uex_provider_ext_uidx" ON "user_external_accounts" USING btree ("provider","external_id");