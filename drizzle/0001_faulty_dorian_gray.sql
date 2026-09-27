ALTER TABLE "chapter_revisions" DROP CONSTRAINT "chapter_revisions_chapter_id_chapters_id_fk";
--> statement-breakpoint
ALTER TABLE "chapters" DROP CONSTRAINT "chapters_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_groups" DROP CONSTRAINT "resource_groups_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "resource_items" DROP CONSTRAINT "resource_items_group_id_resource_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "chapter_revisions" ADD CONSTRAINT "chapter_revisions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_groups" ADD CONSTRAINT "resource_groups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_items" ADD CONSTRAINT "resource_items_group_id_resource_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."resource_groups"("id") ON DELETE cascade ON UPDATE no action;