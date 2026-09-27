import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '../config/env'

export type EncryptedCredential = { encryptedApiKey: string; encryptionIv: string; authTag: string; keyVersion: number; keyLastFour: string }

@Injectable()
export class CredentialCryptoService {
  encrypt(apiKey: string): EncryptedCredential {
    const key = this.key()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
    return { encryptedApiKey: encrypted.toString('base64'), encryptionIv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), keyVersion: 1, keyLastFour: apiKey.slice(-4) }
  }

  decrypt(value: Pick<EncryptedCredential, 'encryptedApiKey' | 'encryptionIv' | 'authTag'>) {
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(value.encryptionIv, 'base64'))
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(value.encryptedApiKey, 'base64')), decipher.final()]).toString('utf8')
  }

  private key() {
    const encoded = env().CREDENTIAL_ENCRYPTION_KEY
    if (!encoded) throw new InternalServerErrorException({ code: 'CREDENTIAL_ENCRYPTION_NOT_CONFIGURED', message: '模型凭证加密尚未配置。' })
    const key = Buffer.from(encoded, 'base64')
    if (key.length !== 32) throw new InternalServerErrorException({ code: 'CREDENTIAL_ENCRYPTION_KEY_INVALID', message: '模型凭证加密密钥必须是 32 字节的 Base64 编码。' })
    return key
  }
}
