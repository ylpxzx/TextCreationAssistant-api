DROP INDEX "model_profiles_credential_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "model_profiles_credential_unique" ON "model_profiles" USING btree ("credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "model_profiles_one_default_per_user" ON "model_profiles" USING btree ("user_id") WHERE "model_profiles"."is_default" = true and "model_profiles"."deleted_at" is null;