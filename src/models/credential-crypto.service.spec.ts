import { beforeAll, describe, expect, it } from 'vitest'
import { CredentialCryptoService } from './credential-crypto.service'

describe('CredentialCryptoService', () => {
  beforeAll(() => { process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64') })

  it('encrypts and decrypts an API key without storing plaintext', () => {
    const service = new CredentialCryptoService()
    const encrypted = service.encrypt('sk-example-secret-1234')
    expect(encrypted.encryptedApiKey).not.toContain('sk-example')
    expect(encrypted.keyLastFour).toBe('1234')
    expect(service.decrypt(encrypted)).toBe('sk-example-secret-1234')
  })

  it('rejects modified authenticated ciphertext', () => {
    const service = new CredentialCryptoService()
    const encrypted = service.encrypt('sk-example-secret-1234')
    expect(() => service.decrypt({ ...encrypted, authTag: Buffer.alloc(16).toString('base64') })).toThrow()
  })
})
