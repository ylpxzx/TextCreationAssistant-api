import JSZip from 'jszip'
import { posix } from 'node:path'

export async function extractEpubText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const container = await zip.file('META-INF/container.xml')?.async('string')
  const rootFile = container?.match(/full-path=["']([^"']+)["']/i)?.[1]
  const orderedFiles = rootFile ? await filesFromPackage(zip, rootFile) : []
  const files = orderedFiles.length > 0 ? orderedFiles : Object.keys(zip.files).filter(name => /\.(xhtml|html|htm)$/i.test(name)).sort()
  const chapters = await Promise.all(files.map(async name => {
    const source = await zip.file(name)?.async('string')
    return source ? htmlToText(source) : ''
  }))
  return chapters.filter(Boolean).join('\n\n--- 章节分隔 ---\n\n')
}

async function filesFromPackage(zip: JSZip, rootFile: string) {
  const source = await zip.file(rootFile)?.async('string')
  if (!source) return []
  const manifest = new Map<string, string>()
  for (const match of source.matchAll(/<item\b[^>]*\bid=["']([^"']+)["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) manifest.set(match[1], match[2])
  for (const match of source.matchAll(/<item\b[^>]*\bhref=["']([^"']+)["'][^>]*\bid=["']([^"']+)["'][^>]*>/gi)) manifest.set(match[2], match[1])
  const directory = posix.dirname(rootFile)
  return [...source.matchAll(/<itemref\b[^>]*\bidref=["']([^"']+)["'][^>]*>/gi)]
    .map(match => manifest.get(match[1]))
    .filter((value): value is string => Boolean(value))
    .map(value => posix.normalize(posix.join(directory, decodeXml(value.split('#')[0]))))
    .filter(name => Boolean(zip.file(name)))
}

function htmlToText(value: string) {
  return decodeXml(value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/blockquote|\/section|\/article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeXml(value: string) {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_match, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    return entities[entity.toLowerCase()] ?? `&${entity};`
  })
}
