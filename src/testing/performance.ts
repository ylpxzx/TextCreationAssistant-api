import { performance } from 'node:perf_hooks'
import postgres from 'postgres'
import { createApplication } from '../bootstrap'
import { env } from '../config/env'
import { selectGenerationContext, type GenerationContextItem } from '../ai/context-selector'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function timed<T>(name: string, limitMs: number, action: () => Promise<T> | T) {
  const started = performance.now()
  const result = await action()
  const elapsedMs = Math.round(performance.now() - started)
  assert(elapsedMs <= limitMs, `${name}耗时 ${elapsedMs}ms，超过基线 ${limitMs}ms`)
  return { result, elapsedMs }
}

async function main() {
  const config = env()
  const app = await createApplication({ logger: false, swagger: false })
  await app.init()
  const server = app.getHttpAdapter().getInstance()
  const sql = postgres(config.DATABASE_URL, { max: 1 })
  const email = `performance-${Date.now()}@example.com`
  const headers = { origin: config.WEB_ORIGIN }
  const measurements: Record<string, number> = {}

  try {
    const registered = await server.inject({ method: 'POST', url: '/v1/auth/register', headers, payload: { email, password: 'Performance123!' } })
    assert(registered.statusCode === 201, `性能测试用户注册失败：${registered.body}`)
    const setCookie = registered.headers['set-cookie']
    assert(typeof setCookie === 'string', '注册响应缺少 Cookie')
    const authenticated = { cookie: setCookie.split(';')[0], origin: config.WEB_ORIGIN }

    const created = await server.inject({ method: 'POST', url: '/v1/projects', headers: authenticated, payload: { title: '长章节性能测试' } })
    assert(created.statusCode === 201, `创建性能测试作品失败：${created.body}`)
    const projectId = created.json().id as string
    const detail = await server.inject({ method: 'GET', url: `/v1/projects/${projectId}`, headers: { cookie: authenticated.cookie } })
    const chapter = detail.json().chapters[0] as { id: string; version: number }
    assert(chapter, '新作品缺少默认章节')

    const longText = '潮水漫过旧城石阶，远处钟声回荡。'.repeat(45_000)
    assert(longText.length >= 700_000, '长章节测试文本不足 70 万字')
    const longSave = await timed('72 万字章节保存', 8_000, () => server.inject({ method: 'PATCH', url: `/v1/chapters/${chapter.id}`, headers: authenticated, payload: { version: chapter.version, plainText: longText, contentJson: { type: 'doc', content: [] } } }))
    assert(longSave.result.statusCode === 200, `长章节保存失败：${longSave.result.statusCode} ${longSave.result.body.slice(0, 300)}`)
    measurements.longChapterSaveMs = longSave.elapsedMs
    let version = longSave.result.json().version as number

    const longRead = await timed('72 万字章节读取', 5_000, () => server.inject({ method: 'GET', url: `/v1/projects/${projectId}`, headers: { cookie: authenticated.cookie } }))
    assert(longRead.result.statusCode === 200, `长章节读取失败：${longRead.result.statusCode}`)
    const readChapter = longRead.result.json().chapters.find((value: { id: string }) => value.id === chapter.id)
    assert(readChapter?.plainText.length === longText.length, '长章节读取内容不完整')
    measurements.longChapterReadMs = longRead.elapsedMs

    const saveText = '连续保存内容。'.repeat(4_000)
    const repeated = await timed('连续 20 次章节保存', 15_000, async () => {
      for (let index = 0; index < 20; index += 1) {
        const response = await server.inject({ method: 'PATCH', url: `/v1/chapters/${chapter.id}`, headers: authenticated, payload: { version, plainText: `${index}\n${saveText}`, contentJson: { type: 'doc', content: [] } } })
        assert(response.statusCode === 200, `第 ${index + 1} 次连续保存失败：${response.statusCode}`)
        version = response.json().version
      }
    })
    measurements.twentySequentialSavesMs = repeated.elapsedMs

    const revisions = await server.inject({ method: 'GET', url: `/v1/chapters/${chapter.id}/revisions?limit=100`, headers: { cookie: authenticated.cookie } })
    assert(revisions.statusCode === 200 && revisions.json().items.length >= 20, '连续保存没有生成完整历史版本')

    const contextItems: GenerationContextItem[] = Array.from({ length: 200 }, (_, index) => {
      const content = index % 20 === 0 ? '重复世界设定'.repeat(800) : `${index}-` + '人物与地点设定'.repeat(700)
      return { sourceType: index === 199 ? 'project' : 'resource-item', sourceId: crypto.randomUUID(), label: `资料 ${index}`, content, characterCount: content.length }
    })
    const context = await timed('200 条资料上下文筛选', 1_000, () => selectGenerationContext(contextItems))
    assert(context.result[0]?.sourceType === 'project', '作品构想没有获得最高优先级')
    assert(context.result.reduce((sum, item) => sum + item.characterCount, 0) <= 60_000, '上下文超过 6 万字预算')
    assert(new Set(context.result.map(item => item.content)).size === context.result.length, '上下文仍包含重复资料')
    measurements.contextSelectionMs = context.elapsedMs

    process.stdout.write(`${JSON.stringify({ status: 'passed', chapterCharacters: longText.length, sequentialSaves: 20, inputContextItems: contextItems.length, selectedContextItems: context.result.length, measurements }, null, 2)}\n`)
  } finally {
    await sql`delete from users where email = ${email}`
    await sql.end()
    await app.close()
  }
}

main().then(() => process.exit(0)).catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : error}\n`, () => process.exit(1))
})
