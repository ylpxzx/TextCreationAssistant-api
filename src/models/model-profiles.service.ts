import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { modelCredentials, modelProfiles } from '../database/schema'
import { CredentialCryptoService } from './credential-crypto.service'
import type { CreateModelProfileInput, UpdateModelProfileInput } from './model-profile.schemas'

@Injectable()
export class ModelProfilesService {
  constructor(@Inject(DATABASE) private readonly db: Database, @Inject(CredentialCryptoService) private readonly crypto: CredentialCryptoService) {}

  async list(userId: string) {
    const rows = await this.db.select({ profile: modelProfiles, keyLastFour: modelCredentials.keyLastFour }).from(modelProfiles).innerJoin(modelCredentials, eq(modelCredentials.id, modelProfiles.credentialId)).where(and(eq(modelProfiles.userId, userId), isNull(modelProfiles.deletedAt), isNull(modelCredentials.deletedAt))).orderBy(desc(modelProfiles.isDefault), desc(modelProfiles.updatedAt))
    return rows.map(row => this.publicProfile(row.profile, row.keyLastFour))
  }

  async create(userId: string, input: CreateModelProfileInput) {
    const encrypted = this.crypto.encrypt(input.apiKey)
    return this.db.transaction(async tx => {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(modelProfiles).where(and(eq(modelProfiles.userId, userId), isNull(modelProfiles.deletedAt)))
      const makeDefault = input.isDefault || count === 0
      if (makeDefault) await tx.update(modelProfiles).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(modelProfiles.userId, userId), isNull(modelProfiles.deletedAt)))
      const [credential] = await tx.insert(modelCredentials).values({ userId, ...encrypted }).returning({ id: modelCredentials.id, keyLastFour: modelCredentials.keyLastFour })
      const [profile] = await tx.insert(modelProfiles).values({ userId, credentialId: credential.id, name: input.name, provider: input.provider, model: input.model, baseUrl: input.baseUrl, isDefault: makeDefault }).returning()
      return this.publicProfile(profile, credential.keyLastFour)
    })
  }

  async update(profileId: string, userId: string, input: UpdateModelProfileInput) {
    const current = await this.record(profileId, userId)
    const { apiKey, ...changes } = input
    return this.db.transaction(async tx => {
      if (apiKey) await tx.update(modelCredentials).set({ ...this.crypto.encrypt(apiKey), updatedAt: new Date() }).where(eq(modelCredentials.id, current.profile.credentialId))
      const [profile] = await tx.update(modelProfiles).set({ ...changes, updatedAt: new Date() }).where(eq(modelProfiles.id, profileId)).returning()
      const [credential] = await tx.select({ keyLastFour: modelCredentials.keyLastFour }).from(modelCredentials).where(eq(modelCredentials.id, profile.credentialId)).limit(1)
      return this.publicProfile(profile, credential.keyLastFour)
    })
  }

  async setDefault(profileId: string, userId: string) {
    const current = await this.record(profileId, userId)
    return this.db.transaction(async tx => {
      await tx.update(modelProfiles).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(modelProfiles.userId, userId), ne(modelProfiles.id, profileId), isNull(modelProfiles.deletedAt)))
      const [profile] = await tx.update(modelProfiles).set({ isDefault: true, updatedAt: new Date() }).where(eq(modelProfiles.id, profileId)).returning()
      return this.publicProfile(profile, current.credential.keyLastFour)
    })
  }

  async remove(profileId: string, userId: string) {
    const current = await this.record(profileId, userId)
    const deletedAt = new Date()
    await this.db.transaction(async tx => {
      await tx.update(modelProfiles).set({ isDefault: false, deletedAt, updatedAt: deletedAt }).where(eq(modelProfiles.id, profileId))
      await tx.update(modelCredentials).set({ deletedAt, updatedAt: deletedAt }).where(eq(modelCredentials.id, current.profile.credentialId))
      if (current.profile.isDefault) {
        const [replacement] = await tx.select({ id: modelProfiles.id }).from(modelProfiles).where(and(eq(modelProfiles.userId, userId), isNull(modelProfiles.deletedAt))).orderBy(desc(modelProfiles.updatedAt)).limit(1)
        if (replacement) await tx.update(modelProfiles).set({ isDefault: true, updatedAt: new Date() }).where(eq(modelProfiles.id, replacement.id))
      }
    })
    return { ok: true }
  }

  async resolveApiKey(profileId: string, userId: string) {
    const current = await this.record(profileId, userId)
    return { ...this.publicProfile(current.profile, current.credential.keyLastFour), apiKey: this.crypto.decrypt(current.credential) }
  }

  async resolveDefaultApiKey(userId: string) {
    const [profile] = await this.db.select({ id: modelProfiles.id }).from(modelProfiles).where(and(eq(modelProfiles.userId, userId), eq(modelProfiles.isDefault, true), isNull(modelProfiles.deletedAt))).limit(1)
    if (!profile) throw new NotFoundException({ code: 'MODEL_PROFILE_NOT_FOUND', message: '请先配置默认模型后再拆书。' })
    return this.resolveApiKey(profile.id, userId)
  }

  private async record(profileId: string, userId: string) {
    const [record] = await this.db.select({ profile: modelProfiles, credential: modelCredentials }).from(modelProfiles).innerJoin(modelCredentials, eq(modelCredentials.id, modelProfiles.credentialId)).where(and(eq(modelProfiles.id, profileId), eq(modelProfiles.userId, userId), isNull(modelProfiles.deletedAt), isNull(modelCredentials.deletedAt))).limit(1)
    if (!record) throw new NotFoundException({ code: 'MODEL_PROFILE_NOT_FOUND', message: '模型配置不存在。' })
    return record
  }

  private publicProfile(profile: typeof modelProfiles.$inferSelect, keyLastFour: string) {
    const { credentialId: _credentialId, userId: _userId, deletedAt: _deletedAt, ...safe } = profile
    return { ...safe, apiKeyHint: `••••${keyLastFour}` }
  }
}
