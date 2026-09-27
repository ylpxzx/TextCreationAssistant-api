import { Module } from '@nestjs/common'
import { ProjectsModule } from '../projects/projects.module'
import { ResourcesController } from './resources.controller'
import { ResourcesService } from './resources.service'

@Module({ imports: [ProjectsModule], controllers: [ResourcesController], providers: [ResourcesService], exports: [ResourcesService] })
export class ResourcesModule {}
