import { Module } from '@nestjs/common'
import { CredentialCryptoService } from './credential-crypto.service'
import { ModelProfilesController } from './model-profiles.controller'
import { ModelProfilesService } from './model-profiles.service'

@Module({ controllers: [ModelProfilesController], providers: [CredentialCryptoService, ModelProfilesService], exports: [ModelProfilesService] })
export class ModelsModule {}
