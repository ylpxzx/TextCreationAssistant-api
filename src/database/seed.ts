import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { hashPassword } from '../auth/password'
import { env } from '../config/env'
import { chapters, projects, resourceGroups, resourceItems, users } from './schema'

async function main() {
  const config = env()
  if (config.NODE_ENV === 'production') throw new Error('生产环境禁止执行开发种子数据。')
  const client = postgres(config.DATABASE_URL, { max: 1 })
  const db = drizzle(client)
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, config.SEED_USER_EMAIL)).limit(1)
    if (existing) {
      console.log(`种子用户已存在：${config.SEED_USER_EMAIL}`)
      return
    }
    await db.transaction(async tx => {
      const [user] = await tx.insert(users).values({ email: config.SEED_USER_EMAIL, passwordHash: await hashPassword(config.SEED_USER_PASSWORD) }).returning({ id: users.id })
      const [project] = await tx.insert(projects).values({ ownerUserId: user.id, title: '雾港拾遗', idea: '一名守灯人在每次退潮后，都会收到一封来自十二年前的信。', genres: ['悬疑'], styles: ['克制'] }).returning({ id: projects.id })
      await tx.insert(chapters).values({ projectId: project.id, title: '第一章 · 潮痕' })
      const [group] = await tx.insert(resourceGroups).values({ projectId: project.id, name: '故事线', useInAi: true }).returning({ id: resourceGroups.id })
      await tx.insert(resourceItems).values({ groupId: group.id, name: '开篇目标', content: '林渡发现父亲留下的航标被人刻意抹去。', useInAi: true })
    })
    console.log(`种子数据创建完成：${config.SEED_USER_EMAIL}`)
  } finally {
    await client.end()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
