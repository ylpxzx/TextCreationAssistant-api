import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { extractEpubText } from './epub-parser'

describe('EPUB parser', () => {
  it('extracts chapter text following the package spine order', async () => {
    const zip = new JSZip()
    zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>')
    zip.file('OPS/content.opf', '<package><manifest><item id="two" href="two.xhtml"/><item id="one" href="one.xhtml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>')
    zip.file('OPS/one.xhtml', '<html><body><h1>第一章</h1><p>潮水上涨。</p></body></html>')
    zip.file('OPS/two.xhtml', '<html><body><h1>第二章</h1><p>灯塔亮了&amp;船回来了。</p></body></html>')
    const text = await extractEpubText(await zip.generateAsync({ type: 'nodebuffer' }))
    expect(text.indexOf('第一章')).toBeLessThan(text.indexOf('第二章'))
    expect(text).toContain('灯塔亮了&船回来了。')
  })
})
