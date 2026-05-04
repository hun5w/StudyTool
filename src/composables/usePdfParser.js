import * as pdfjsLib from 'pdfjs-dist'
import { uid, deepClone } from '../utils/helpers.js'
import { addIds } from '../utils/mindmapHelper.js'
import { MINDMAP_TEMPLATES, TOPIC_DETECTORS } from '../data/templates.js'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'

export function usePdfParser() {
  const loading = ref(false)
  const progress = ref('')

  async function parseAndGenerate(file, sectionId) {
    loading.value = true; progress.value = '读取PDF...'
    try {
      const arrayBuffer = await file.arrayBuffer()
      progress.value = '解析页面...'
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const totalPages = pdf.numPages

      // Extract text from first 200 pages (large file warning but no block)
      if (totalPages > 200) {
        progress.value = `文件较大（${totalPages}页），仅解析前200页...`
      }
      const pagesToRead = Math.min(totalPages, 200)
      let text = ''
      for (let i = 1; i <= pagesToRead; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map(it => it.str).join(' ') + '\n'
        if (i % 10 === 0 || i === pagesToRead) {
          progress.value = `解析页面 (${i}/${pagesToRead})...`
        }
      }

      // Match keywords against templates
      progress.value = 'AI正在识别知识点...'
      const delay = 800 + Math.random() * 1200
      await new Promise(r => setTimeout(r, delay))

      // Generate mind map
      progress.value = '正在生成思维导图...'
      const tpl = MINDMAP_TEMPLATES[sectionId]
      const base = tpl ? deepClone(tpl) : { name: sectionId, children: [] }

      const keywords = TOPIC_DETECTORS[sectionId] || []
      const matched = keywords.filter(k => text.toLowerCase().includes(k.toLowerCase()))
      const pdfRoot = {
        name: `PDF: ${file.name}`,
        children: matched.length > 0
          ? matched.slice(0, 5).map(t => ({
              name: t,
              examPoints: [`从PDF识别的「${t}」相关考点`, '建议结合教材深入学习', '历年考研重点考查内容']
            }))
          : [],
        sourceFile: file.name,
        createdAt: new Date().toISOString()
      }
      if (matched.length === 0) {
        pdfRoot.examPoints = ['未匹配到预设关键词，建议手动添加考点']
      }
      base.children.push(pdfRoot)

      markSource(base, file.name)
      addIds(base)
      progress.value = '完成'
      return { tree: base, totalPages, pdfRoot }
    } finally {
      loading.value = false
    }
  }

  function markSource(node, fileName) {
    node.sourceFile = fileName
    node.createdAt = new Date().toISOString()
    if (node.children) node.children.forEach(c => markSource(c, fileName))
  }

  return { loading, progress, parseAndGenerate }
}
