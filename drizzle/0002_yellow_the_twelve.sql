CREATE TABLE "model_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"encryption_iv" varchar(32) NOT NULL,
	"auth_tag" varchar(32) NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"key_last_four" varchar(4) NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"provider" varchar(40) NOT NULL,
	"model" varchar(160) NOT NULL,
	"base_url" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "model_credentials" ADD CONSTRAINT "model_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_profiles" ADD CONSTRAINT "model_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_profiles" ADD CONSTRAINT "model_profiles_credential_id_model_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."model_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_credentials_user_idx" ON "model_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "model_profiles_user_idx" ON "model_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "model_profiles_credential_idx" ON "model_profiles" USING btree ("credential_id");