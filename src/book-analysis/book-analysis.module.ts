import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { ModelsModule } from '../models/models.module'
import { BookAnalysisController } from './book-analysis.controller'
import { BookAnalysisService } from './book-analysis.service'

@Module({ imports: [AiModule, ModelsModule], controllers: [BookAnalysisController], providers: [BookAnalysisService] })
export class BookAnalysisModule {}
