import { Module } from '@nestjs/common'
import { ProjectsModule } from '../projects/projects.module'
import { CreativeIntelligenceController } from './creative-intelligence.controller'
import { CreativeIntelligenceService } from './creative-intelligence.service'
@Module({ imports: [ProjectsModule], controllers: [CreativeIntelligenceController], providers: [CreativeIntelligenceService], exports: [CreativeIntelligenceService] })
export class CreativeIntelligenceModule {}
