import { Module } from '@nestjs/common'
import { ProjectsModule } from '../projects/projects.module'
import { ChaptersController } from './chapters.controller'
import { ChaptersService } from './chapters.service'

@Module({ imports: [ProjectsModule], controllers: [ChaptersController], providers: [ChaptersService] })
export class ChaptersModule {}
