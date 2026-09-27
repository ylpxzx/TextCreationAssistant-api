import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  ...timestamps,
}, table => [uniqueIndex('users_email_unique').on(table.email)])

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('sessions_token_hash_unique').on(table.tokenHash), index('sessions_user_id_idx').on(table.userId)])

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  idea: text('idea').notNull().default(''),
  genres: jsonb('genres').$type<string[]>().notNull().default([]),
  lengthType: varchar('length_type', { length: 40 }).notNull().default('中长篇'),
  styles: jsonb('styles').$type<string[]>().notNull().default([]),
  totalWords: integer('total_words').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, table => [index('projects_owner_updated_idx').on(table.ownerUserId, table.updatedAt)])

export const chapters = pgTable('chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  contentJson: jsonb('content_json').$type<Record<string, unknown>>().notNull().default({ type: 'doc', content: [{ type: 'paragraph' }] }),
  plainText: text('plain_text').notNull().default(''),
  wordCount: integer('word_count').notNull().default(0),
  version: integer('version').notNull().default(1),
  status: varchar('status', { length: 20 }).$type<'draft' | 'writing' | 'done'>().notNull().default('writing'),
  orderIndex: integer('order_index').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, table => [index('chapters_project_order_idx').on(table.projectId, table.orderIndex)])

export const chapterRevisions = pgTable('chapter_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  contentJson: jsonb('content_json').$type<Record<string, unknown>>().notNull(),
  plainText: text('plain_text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('chapter_revisions_chapter_version_unique').on(table.chapterId, table.version)])

export const resourceGroups = pgTable('resource_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  useInAi: boolean('use_in_ai').notNull().default(true),
  orderIndex: integer('order_index').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, table => [index('resource_groups_project_order_idx').on(table.projectId, table.orderIndex)])

export const resourceItems = pgTable('resource_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => resourceGroups.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  content: text('content').notNull().default(''),
  useInAi: boolean('use_in_ai').notNull().default(true),
  orderIndex: integer('order_index').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, table => [index('resource_items_group_order_idx').on(table.groupId, table.orderIndex)])

export const modelCredentials = pgTable('model_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  encryptionIv: varchar('encryption_iv', { length: 32 }).notNull(),
  authTag: varchar('auth_tag', { length: 32 }).notNull(),
  keyVersion: integer('key_version').notNull().default(1),
  keyLastFour: varchar('key_last_four', { length: 4 }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, table => [index('model_credentials_user_idx').on(table.userId)])

export const modelProfiles = pgTable('model_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  credentialId: uuid('credential_id').notNull().references(() => modelCredentials.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  provider: varchar('provider', { length: 40 }).$type<'openai' | 'openai-compatible'>().notNull(),
  model: varchar('model', { length: 160 }).notNull(),
  baseUrl: text('base_url').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, table => [
  index('model_profiles_user_idx').on(table.userId),
  uniqueIndex('model_profiles_credential_unique').on(table.credentialId),
  uniqueIndex('model_profiles_one_default_per_user').on(table.userId).where(sql`${table.isDefault} = true and ${table.deletedAt} is null`),
])

export const generationRecords = pgTable('generation_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
  modelProfileId: uuid('model_profile_id').references(() => modelProfiles.id, { onDelete: 'set null' }),
  operation: varchar('operation', { length: 24 }).$type<'completion' | 'rewrite' | 'chapter' | 'question'>().notNull(),
  status: varchar('status', { length: 24 }).$type<'pending' | 'streaming' | 'completed' | 'cancelled' | 'failed'>().notNull().default('pending'),
  promptVersion: varchar('prompt_version', { length: 40 }).notNull(),
  provider: varchar('provider', { length: 40 }).notNull(),
  model: varchar('model', { length: 160 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 128 }),
  inputCharacters: integer('input_characters').notNull().default(0),
  outputCharacters: integer('output_characters').notNull().default(0),
  finishReason: varchar('finish_reason', { length: 40 }),
  errorCode: varchar('error_code', { length: 80 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),
  ...timestamps,
}, table => [
  index('generation_records_user_created_idx').on(table.userId, table.createdAt),
  index('generation_records_project_created_idx').on(table.projectId, table.createdAt),
  uniqueIndex('generation_records_user_idempotency_unique').on(table.userId, table.idempotencyKey).where(sql`${table.idempotencyKey} is not null`),
])

export const generationContextItems = pgTable('generation_context_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  generationId: uuid('generation_id').notNull().references(() => generationRecords.id, { onDelete: 'cascade' }),
  sourceType: varchar('source_type', { length: 40 }).$type<'project' | 'chapter' | 'resource-item'>().notNull(),
  sourceId: uuid('source_id'),
  label: varchar('label', { length: 240 }).notNull(),
  characterCount: integer('character_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('generation_context_generation_idx').on(table.generationId)])

export const usageLedger = pgTable('usage_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  generationId: uuid('generation_id').notNull().references(() => generationRecords.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 40 }).notNull(),
  model: varchar('model', { length: 160 }).notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  providerRequestId: varchar('provider_request_id', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('usage_ledger_generation_unique').on(table.generationId), index('usage_ledger_user_created_idx').on(table.userId, table.createdAt)])

export const bookAnalyses = pgTable('book_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 500 }).notNull(),
  title: varchar('title', { length: 300 }).notNull().default('未命名原创方案'),
  characterCount: integer('character_count').notNull().default(0),
  model: varchar('model', { length: 160 }).notNull(),
  sourceAnalysis: jsonb('source_analysis').$type<Record<string, unknown>>().notNull(),
  originalPlan: jsonb('original_plan').$type<Record<string, unknown>>().notNull(),
  ...timestamps,
}, table => [index('book_analyses_user_updated_idx').on(table.userId, table.updatedAt)])

export type CreativeStateData = {
  styleProfile: { summary: string; preferredPatterns: string[]; bannedPatterns: string[] }
  characterVoices: Array<{ id: string; name: string; description: string; catchphrases: string[]; bannedPatterns: string[] }>
  sceneCards: Array<{ id: string; chapterId: string; goal: string; conflict: string; characters: string[]; location: string; requiredEvents: string[]; forbiddenReveals: string[]; emotionalArc: string; targetWords: number; hook: string; beats: string[] }>
  editMarks: Array<{ id: string; chapterId: string; excerpt: string; kind: string; note: string; resolved: boolean; createdAt: string }>
  branches: Array<{ id: string; name: string; description: string; chapterId: string; content: string; createdAt: string }>
  stateSuggestions: Array<{ id: string; chapterId: string; category: string; subject: string; before: string; after: string; status: 'pending' | 'accepted' | 'rejected' }>
  consistencyIssues: Array<{ id: string; chapterId?: string; severity: 'certain' | 'possible' | 'notice'; title: string; description: string; evidence: string[]; status: 'open' | 'ignored' | 'resolved' }>
}

export const projectCreativeStates = pgTable('project_creative_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<CreativeStateData>().notNull(),
  ...timestamps,
}, table => [uniqueIndex('project_creative_states_project_unique').on(table.projectId)])

export type User = typeof users.$inferSelect
export type Project = typeof projects.$inferSelect
export type Chapter = typeof chapters.$inferSelect
export type ResourceGroup = typeof resourceGroups.$inferSelect
export type ResourceItem = typeof resourceItems.$inferSelect
export type ModelCredential = typeof modelCredentials.$inferSelect
export type ModelProfile = typeof modelProfiles.$inferSelect
export type GenerationRecord = typeof generationRecords.$inferSelect
export type GenerationContextItem = typeof generationContextItems.$inferSelect
export type UsageLedgerEntry = typeof usageLedger.$inferSelect
export type BookAnalysis = typeof bookAnalyses.$inferSelect
export type ProjectCreativeState = typeof projectCreativeStates.$inferSelect
