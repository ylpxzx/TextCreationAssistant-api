CREATE TABLE "book_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"title" varchar(300) DEFAULT '未命名原创方案' NOT NULL,
	"character_count" integer DEFAULT 0 NOT NULL,
	"model" varchar(160) NOT NULL,
	"source_analysis" jsonb NOT NULL,
	"original_plan" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_analyses" ADD CONSTRAINT "book_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_analyses_user_updated_idx" ON "book_analyses" USING btree ("user_id","updated_at");