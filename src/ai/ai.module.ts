import { Module } from '@nestjs/common'
import { GenerationsModule } from '../generations/generations.module'
import { ModelsModule } from '../models/models.module'
import { ProjectsModule } from '../projects/projects.module'
import { ResourcesModule } from '../resources/resources.module'
import { CreativeIntelligenceModule } from '../creative-intelligence/creative-intelligence.module'
import { ActiveGenerationsService } from './active-generations.service'
import { AiController } from './ai.controller'
import { AiOrchestratorService } from './ai-orchestrator.service'
import { AiRateLimitGuard } from './ai-rate-limit.guard'
import { AiServiceClient } from './ai-service.client'

@Module({ imports: [ProjectsModule, ResourcesModule, ModelsModule, GenerationsModule, CreativeIntelligenceModule], controllers: [AiController], providers: [AiOrchestratorService, AiServiceClient, ActiveGenerationsService, AiRateLimitGuard], exports: [AiServiceClient] })
export class AiModule {}
