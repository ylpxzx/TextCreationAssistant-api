import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { env } from '../config/env'

async function main() {
  const client = postgres(env().DATABASE_URL, { max: 1 })
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  await client.end()
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
