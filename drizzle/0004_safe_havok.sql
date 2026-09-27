CREATE TABLE "generation_context_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"source_type" varchar(40) NOT NULL,
	"source_id" uuid,
	"label" varchar(240) NOT NULL,
	"character_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"chapter_id" uuid,
	"model_profile_id" uuid,
	"operation" varchar(24) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"prompt_version" varchar(40) NOT NULL,
	"provider" varchar(40) NOT NULL,
	"model" varchar(160) NOT NULL,
	"idempotency_key" varchar(128),
	"input_characters" integer DEFAULT 0 NOT NULL,
	"output_characters" integer DEFAULT 0 NOT NULL,
	"finish_reason" varchar(40),
	"error_code" varchar(80),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"model" varchar(160) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"provider_request_id" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_context_items" ADD CONSTRAINT "generation_context_items_generation_id_generation_records_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generation_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_records" ADD CONSTRAINT "generation_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_records" ADD CONSTRAINT "generation_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_records" ADD CONSTRAINT "generation_records_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_records" ADD CONSTRAINT "generation_records_model_profile_id_model_profiles_id_fk" FOREIGN KEY ("model_profile_id") REFERENCES "public"."model_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_generation_id_generation_records_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generation_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_context_generation_idx" ON "generation_context_items" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "generation_records_user_created_idx" ON "generation_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "generation_records_project_created_idx" ON "generation_records" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_records_user_idempotency_unique" ON "generation_records" USING btree ("user_id","idempotency_key") WHERE "generation_records"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_ledger_generation_unique" ON "usage_ledger" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "usage_ledger_user_created_idx" ON "usage_ledger" USING btree ("user_id","created_at");