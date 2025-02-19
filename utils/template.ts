// @ts-ignore
import Handlebars from "handlebars/runtime"
import { logger, LogCategory } from "./logger"
import { defaultTemplate } from "../templates/article.precompiled"

// 注册 Handlebars 助手函数
Handlebars.registerHelper('addOne', function(value: number) {
  return value + 1
})

Handlebars.registerHelper('boldFirstSentence', function(text: string) {
  if (!text) return ''
  const sentences = text.split(/(?<=[.!?])\s+/)
  if (sentences.length === 0) return text
  
  const firstSentence = sentences[0]
  const restSentences = sentences.slice(1).join(' ')
  
  return new Handlebars.SafeString(
    `<strong>${firstSentence}</strong> ${restSentences}`
  )
})

// 缓存预编译的模板
const templateCache = new Map<string, HandlebarsTemplateDelegate>([
  ['default', defaultTemplate]
])

// 获取预编译的模板
export function getCompiledTemplate(_templateString: string, templateName: string): HandlebarsTemplateDelegate {
  if (!templateCache.has(templateName)) {
    logger.warn('未找到预编译模板，使用默认模板', {
      category: LogCategory.ARTICLE,
      data: { templateName }
    })
    return defaultTemplate
  }
  return templateCache.get(templateName)!
}

// 渲染模板
export function renderTemplate(template: HandlebarsTemplateDelegate, data: any): string {
  try {
    return template(data)
  } catch (error) {
    logger.error('模板渲染失败', {
      category: LogCategory.ARTICLE,
      data: { error }
    })
    throw error
  }
} 