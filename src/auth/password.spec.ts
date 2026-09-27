import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('verifies the correct password and rejects a different one', async () => {
    const encoded = await hashPassword('a-secure-password')
    expect(encoded).not.toContain('a-secure-password')
    await expect(verifyPassword('a-secure-password', encoded)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password', encoded)).resolves.toBe(false)
  })

  it('uses a unique salt for each hash', async () => {
    const first = await hashPassword('a-secure-password')
    const second = await hashPassword('a-secure-password')
    expect(first).not.toBe(second)
  })
})
