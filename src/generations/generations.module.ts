import { Module } from '@nestjs/common'
import { GenerationsService } from './generations.service'

@Module({ providers: [GenerationsService], exports: [GenerationsService] })
export class GenerationsModule {}
