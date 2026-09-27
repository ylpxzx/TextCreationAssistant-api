import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthModule } from './auth/auth.module'
import { ChaptersModule } from './chapters/chapters.module'
import { DatabaseModule } from './database/database.module'
import { HealthController } from './health.controller'
import { ProjectsModule } from './projects/projects.module'
import { ResourcesModule } from './resources/resources.module'
import { OriginGuard } from './common/origin.guard'
import { ModelsModule } from './models/models.module'
import { GenerationsModule } from './generations/generations.module'
import { AiModule } from './ai/ai.module'
import { BookAnalysisModule } from './book-analysis/book-analysis.module'
import { CreativeIntelligenceModule } from './creative-intelligence/creative-intelligence.module'

@Module({
  imports: [DatabaseModule, AuthModule, ProjectsModule, ChaptersModule, ResourcesModule, ModelsModule, GenerationsModule, AiModule, BookAnalysisModule, CreativeIntelligenceModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: OriginGuard }],
})
export class AppModule {}
