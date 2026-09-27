import { Global, Module } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env'
import { DATABASE } from './database.constants'
import * as schema from './schema'

export type Database = ReturnType<typeof drizzle<typeof schema>>

@Global()
@Module({
  providers: [{
    provide: DATABASE,
    useFactory: () => {
      const client = postgres(env().DATABASE_URL, { max: 10 })
      return drizzle(client, { schema })
    },
  }],
  exports: [DATABASE],
})
export class DatabaseModule {}
