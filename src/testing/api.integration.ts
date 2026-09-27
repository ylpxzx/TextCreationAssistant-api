import postgres from 'postgres'
import Fastify from 'fastify'
import { createApplication } from '../bootstrap'
import { env } from '../config/env'
import { GenerationsService } from '../generations/generations.service'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  process.env.CREDENTIAL_ENCRYPTION_KEY ||= Buffer.alloc(32, 9).toString('base64')
  const aiToken = 'integration-ai-service-token-1234567890'
  const fakeAi = Fastify({ logger: false })
  fakeAi.addHook('onRequest', async (request, reply) => { if (request.headers.authorization !== `Bearer ${aiToken}`) return reply.code(401).send({ error: { code: 'INTERNAL_UNAUTHORIZED' } }) })
  fakeAi.post('/internal/v1/models:test', async () => ({ ok: true, model: 'example-model-v2', latencyMs: 1, responseReceived: true }))
  fakeAi.post('/internal/v1/generations:stream', async (request, reply) => {
    const body = request.body as { generationId: string; model: { apiKey?: string } }
    assert(body.model.apiKey === 'sk-rotated-secret-4321', '核心 API 没有向内部 AI Service 提供解密后的凭证')
    reply.hijack(); reply.raw.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' })
    const events = [
      { event: 'generation.start', generationId: body.generationId, sequence: 0, model: 'example-model-v2' },
      { event: 'generation.delta', generationId: body.generationId, sequence: 1, text: '潮水继续上涨。' },
      { event: 'generation.usage', generationId: body.generationId, sequence: 2, inputTokens: 20, outputTokens: 8, totalTokens: 28 },
      { event: 'generation.done', generationId: body.generationId, sequence: 3, finishReason: 'stop', outputCharacters: 8 },
    ]
    for (const event of events) reply.raw.write(`event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`)
    reply.raw.end()
  })
  await fakeAi.listen({ host: '127.0.0.1', port: 0 })
  const fakeAddress = fakeAi.server.address()
  assert(fakeAddress && typeof fakeAddress === 'object', '无法启动测试 AI Service')
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${fakeAddress.port}`
  process.env.AI_SERVICE_TOKEN = aiToken
  const app = await createApplication({ logger: false, swagger: false })
  await app.init()
  const server = app.getHttpAdapter().getInstance()
  const email = `integration-${Date.now()}@example.com`
  const secondEmail = `integration-other-${Date.now()}@example.com`
  const password = 'Integration123!'
  const sql = postgres(env().DATABASE_URL, { max: 1 })
  try {
    const registered = await server.inject({ method: 'POST', url: '/v1/auth/register', headers: { origin: env().WEB_ORIGIN }, payload: { email, password } })
    assert(registered.statusCode === 201, `注册失败：${registered.statusCode} ${registered.body}`)
    const cookie = registered.headers['set-cookie']
    assert(typeof cookie === 'string', '注册响应缺少 Session Cookie')
    const sessionCookie = cookie.split(';')[0]
    const userId = registered.json().user.id

    const created = await server.inject({ method: 'POST', url: '/v1/projects', headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { title: '集成测试作品', genres: ['悬疑'], styles: ['克制'] } })
    assert(created.statusCode === 201, `创建作品失败：${created.statusCode} ${created.body}`)
    const project = created.json()

    const detail = await server.inject({ method: 'GET', url: `/v1/projects/${project.id}`, headers: { cookie: sessionCookie } })
    assert(detail.statusCode === 200, `查询作品失败：${detail.statusCode}`)
    const chapter = detail.json().chapters[0]
    assert(chapter?.version === 1, '新作品没有默认章节')

    const saved = await server.inject({ method: 'PATCH', url: `/v1/chapters/${chapter.id}`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { version: 1, plainText: '雨停在凌晨四点。', contentJson: { type: 'doc', content: [] }, status: 'draft' } })
    assert(saved.statusCode === 200 && saved.json().version === 2, `章节保存或版本递增失败：${saved.body}`)

    const conflict = await server.inject({ method: 'PATCH', url: `/v1/chapters/${chapter.id}`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { version: 1, status: 'done' } })
    assert(conflict.statusCode === 409, '旧版本保存没有返回 409 冲突')

    const revisions = await server.inject({ method: 'GET', url: `/v1/chapters/${chapter.id}/revisions?limit=1`, headers: { cookie: sessionCookie } })
    assert(revisions.statusCode === 200 && revisions.json().items.length === 1, `查询历史版本失败：${revisions.body}`)
    const revision = revisions.json().items[0]
    assert(revision.version === 1 && revision.contentJson === undefined, '历史版本列表不应返回完整正文 JSON')

    const revisionDetail = await server.inject({ method: 'GET', url: `/v1/chapters/${chapter.id}/revisions/${revision.id}`, headers: { cookie: sessionCookie } })
    assert(revisionDetail.statusCode === 200 && revisionDetail.json().version === 1, `查询历史版本详情失败：${revisionDetail.body}`)

    const restored = await server.inject({ method: 'POST', url: `/v1/chapters/${chapter.id}/revisions/${revision.id}/restore`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { expectedVersion: 2 } })
    assert(restored.statusCode === 201 && restored.json().version === 3, `恢复历史版本失败：${restored.body}`)

    const groupResponse = await server.inject({ method: 'POST', url: `/v1/projects/${project.id}/resource-groups`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { name: '世界规则', useInAi: false } })
    assert(groupResponse.statusCode === 201, `创建资料分类失败：${groupResponse.body}`)
    const group = groupResponse.json()
    const item = await server.inject({ method: 'POST', url: `/v1/resource-groups/${group.id}/items`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { name: '潮汐规则', content: '满潮时暗渠关闭。', useInAi: true } })
    assert(item.statusCode === 201, `创建资料失败：${item.body}`)

    const profileResponse = await server.inject({ method: 'POST', url: '/v1/model-profiles', headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { name: '默认模型', provider: 'openai-compatible', model: 'example-model', baseUrl: 'https://models.example.com/v1', apiKey: 'sk-integration-secret-9876' } })
    assert(profileResponse.statusCode === 201, `创建模型配置失败：${profileResponse.body}`)
    const profile = profileResponse.json()
    assert(profile.apiKeyHint === '••••9876' && profile.apiKey === undefined && profile.encryptedApiKey === undefined, '模型配置响应泄露密钥或未返回末四位')

    const profiles = await server.inject({ method: 'GET', url: '/v1/model-profiles', headers: { cookie: sessionCookie } })
    assert(profiles.statusCode === 200 && profiles.json()[0].isDefault === true, `首个模型没有自动设为默认：${profiles.body}`)

    const updatedProfile = await server.inject({ method: 'PATCH', url: `/v1/model-profiles/${profile.id}`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { model: 'example-model-v2', apiKey: 'sk-rotated-secret-4321' } })
    assert(updatedProfile.statusCode === 200 && updatedProfile.json().apiKeyHint === '••••4321', `模型凭证轮换失败：${updatedProfile.body}`)

    const otherRegistered = await server.inject({ method: 'POST', url: '/v1/auth/register', headers: { origin: env().WEB_ORIGIN }, payload: { email: secondEmail, password } })
    assert(otherRegistered.statusCode === 201 && typeof otherRegistered.headers['set-cookie'] === 'string', `第二个测试用户注册失败：${otherRegistered.body}`)
    const otherCookie = (otherRegistered.headers['set-cookie'] as string).split(';')[0]
    const forbiddenProject = await server.inject({ method: 'GET', url: `/v1/projects/${project.id}`, headers: { cookie: otherCookie } })
    const forbiddenChapter = await server.inject({ method: 'PATCH', url: `/v1/chapters/${chapter.id}`, headers: { cookie: otherCookie, origin: env().WEB_ORIGIN }, payload: { version: 3, title: '越权修改' } })
    const forbiddenGroup = await server.inject({ method: 'PATCH', url: `/v1/resource-groups/${group.id}`, headers: { cookie: otherCookie, origin: env().WEB_ORIGIN }, payload: { name: '越权修改' } })
    const forbiddenProfile = await server.inject({ method: 'PATCH', url: `/v1/model-profiles/${profile.id}`, headers: { cookie: otherCookie, origin: env().WEB_ORIGIN }, payload: { name: '越权修改' } })
    assert([forbiddenProject, forbiddenChapter, forbiddenGroup, forbiddenProfile].every(response => response.statusCode === 404), '跨用户访问没有统一隐藏为 404')

    const disposableChapter = await server.inject({ method: 'POST', url: `/v1/projects/${project.id}/chapters`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { title: '待删除章节' } })
    assert(disposableChapter.statusCode === 201, `创建待删除章节失败：${disposableChapter.body}`)
    const deletedChapter = await server.inject({ method: 'DELETE', url: `/v1/chapters/${disposableChapter.json().id}`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN } })
    const detailAfterDelete = await server.inject({ method: 'GET', url: `/v1/projects/${project.id}`, headers: { cookie: sessionCookie } })
    assert(deletedChapter.statusCode === 200 && !detailAfterDelete.json().chapters.some((value: { id: string }) => value.id === disposableChapter.json().id), '软删除章节仍出现在作品详情中')

    const disposableGroup = await server.inject({ method: 'POST', url: `/v1/projects/${project.id}/resource-groups`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { name: '待删除资料组' } })
    const disposableItem = await server.inject({ method: 'POST', url: `/v1/resource-groups/${disposableGroup.json().id}/items`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN }, payload: { name: '待删除资料', content: '临时内容' } })
    const deletedItem = await server.inject({ method: 'DELETE', url: `/v1/resource-items/${disposableItem.json().id}`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN } })
    const resourcesAfterItemDelete = await server.inject({ method: 'GET', url: `/v1/projects/${project.id}/resources`, headers: { cookie: sessionCookie } })
    const remainingDisposableGroup = resourcesAfterItemDelete.json().find((value: { id: string }) => value.id === disposableGroup.json().id)
    assert(deletedItem.statusCode === 200 && remainingDisposableGroup?.items.length === 0, '软删除资料仍出现在资料列表中')
    const deletedGroup = await server.inject({ method: 'DELETE', url: `/v1/resource-groups/${disposableGroup.json().id}`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN } })
    const resourcesAfterGroupDelete = await server.inject({ method: 'GET', url: `/v1/projects/${project.id}/resources`, headers: { cookie: sessionCookie } })
    assert(deletedGroup.statusCode === 200 && !resourcesAfterGroupDelete.json().some((value: { id: string }) => value.id === disposableGroup.json().id), '软删除资料组仍出现在资料列表中')

    const connectionTest = await server.inject({ method: 'POST', url: `/v1/model-profiles/${profile.id}/test`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN } })
    assert(connectionTest.statusCode === 201 && connectionTest.json().ok === true, `模型连接测试转发失败：${connectionTest.body}`)

    const streamed = await server.inject({ method: 'POST', url: '/v1/ai/generations:stream', headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN, 'idempotency-key': `public-stream-${Date.now()}` }, payload: { operation: 'completion', projectId: project.id, chapterId: chapter.id, chapterVersion: 3, modelProfileId: profile.id, instruction: '继续写', cursorContext: '' } })
    assert(streamed.statusCode === 200 && streamed.body.includes('generation.delta') && streamed.body.includes('潮水继续上涨。'), `核心 API 没有正确转发 SSE：${streamed.body}`)
    assert(streamed.headers['access-control-allow-origin'] === env().WEB_ORIGIN && streamed.headers['access-control-allow-credentials'] === 'true', 'SSE 响应缺少浏览器所需的 CORS 头')
    assert(!streamed.body.includes('sk-rotated-secret-4321'), '核心 API 的 SSE 响应泄露了模型凭证')

    const generations = app.get(GenerationsService)
    const idempotencyKey = `integration-${Date.now()}`
    const started = await generations.start({ userId, projectId: project.id, chapterId: chapter.id, modelProfileId: profile.id, operation: 'completion', promptVersion: 'completion-v1', provider: 'openai-compatible', model: 'example-model-v2', idempotencyKey, inputCharacters: 120, context: [{ sourceType: 'resource-item', sourceId: item.json().id, label: '世界规则 / 潮汐规则', characterCount: 8 }] })
    assert(started.reused === false && started.record.status === 'streaming', '生成记录没有进入 streaming 状态')
    const reused = await generations.start({ userId, projectId: project.id, chapterId: chapter.id, modelProfileId: profile.id, operation: 'completion', promptVersion: 'completion-v1', provider: 'openai-compatible', model: 'example-model-v2', idempotencyKey, inputCharacters: 120, context: [] })
    assert(reused.reused === true && reused.record.id === started.record.id, '相同幂等键没有复用原生成记录')
    const completed = await generations.complete(started.record.id, userId, { outputCharacters: 42, finishReason: 'stop', inputTokens: 80, outputTokens: 30, providerRequestId: 'provider-test-1' })
    assert(completed.status === 'completed' && completed.outputCharacters === 42, '生成记录没有正确完成')
    const [usage] = await sql<{ total_tokens: number }[]>`select total_tokens from usage_ledger where generation_id = ${started.record.id}`
    const [contextCount] = await sql<{ count: number }[]>`select count(*)::int as count from generation_context_items where generation_id = ${started.record.id}`
    assert(usage?.total_tokens === 110 && contextCount?.count === 1, 'Token 用量或引用资料没有正确入账')

    const cancellable = await generations.start({ userId, projectId: project.id, chapterId: chapter.id, modelProfileId: profile.id, operation: 'completion', promptVersion: 'completion-v1', provider: 'openai-compatible', model: 'example-model-v2', idempotencyKey: `cancel-${Date.now()}`, inputCharacters: 20, context: [] })
    const forbiddenCancel = await server.inject({ method: 'DELETE', url: `/v1/ai/generations/${cancellable.record.id}`, headers: { cookie: otherCookie, origin: env().WEB_ORIGIN } })
    const cancelled = await server.inject({ method: 'DELETE', url: `/v1/ai/generations/${cancellable.record.id}`, headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN } })
    const [cancelledRecord] = await sql<{ status: string }[]>`select status from generation_records where id = ${cancellable.record.id}`
    assert(forbiddenCancel.statusCode === 404 && cancelled.statusCode === 200 && cancelledRecord?.status === 'cancelled', '生成取消接口或权限校验失败')

    const rejectedOrigin = await server.inject({ method: 'POST', url: `/v1/projects/${project.id}/chapters`, headers: { cookie: sessionCookie, origin: 'https://untrusted.example' }, payload: {} })
    assert(rejectedOrigin.statusCode === 403, '不可信来源没有被拒绝')

    const refreshed = await server.inject({ method: 'POST', url: '/v1/auth/session/refresh', headers: { cookie: sessionCookie, origin: env().WEB_ORIGIN } })
    assert(refreshed.statusCode === 201 && typeof refreshed.headers['set-cookie'] === 'string', 'Session 续期失败')
    console.log('API 集成测试通过：认证、权限隔离、软删除、章节历史、加密凭证、模型测试、SSE 转发、生成取消、用量入账和 Session 安全')
  } finally {
    await sql`delete from users where email = ${email}`
    await sql`delete from users where email = ${secondEmail}`
    await sql.end()
    await app.close()
    await fakeAi.close()
  }
}

main().then(() => process.exit(0)).catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : error}\n`, () => process.exit(1))
})
