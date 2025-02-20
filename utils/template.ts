// @ts-ignore
import Handlebars from "handlebars/runtime"
import { logger, LogCategory } from "./logger"
import { apiClient } from "./api"
import { ApiEndpoints } from "../types/api"
import type { TemplateResponse } from "../types/api"

const API_BASE_URL = process.env.PLASMO_PUBLIC_ARTICLE_API || 'http://localhost:5000'
const DEFAULT_TEMPLATE = '----没有配置模板----'

// HTML 清理和处理函数
function sanitizeHtml(html: string): string {
  try {
    // 移除可能有问题的脚本标签
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    
    // 处理特殊字符
    html = html.replace(/&nbsp;/g, ' ')
    html = html.replace(/&quot;/g, '"')
    html = html.replace(/&amp;/g, '&')
    html = html.replace(/&lt;/g, '<')
    html = html.replace(/&gt;/g, '>')

    // 统一换行符
    html = html.replace(/\r\n/g, '\n')
    html = html.replace(/\r/g, '\n')

    // 移除多余的空行
    html = html.replace(/\n\s*\n\s*\n/g, '\n\n')

    return html.trim()
  } catch (error) {
    logger.error('HTML清理失败', {
      category: LogCategory.TEMPLATE,
      data: { error }
    })
    return html
  }
}

// 处理图片和资源链接
function processResources(html: string): string {
  try {
    // 处理图片链接
    html = html.replace(
      /<img[^>]+src="([^"]+)"[^>]*>/g,
      (match, src) => {
        // 如果是base64图片，直接返回
        if (src.startsWith('data:image')) {
          return match
        }
        // 如果是相对路径，添加域名
        if (src.startsWith('/')) {
          return match.replace(src, `${API_BASE_URL}${src}`)
        }
        return match
      }
    )

    // 处理其他资源链接
    html = html.replace(
      /<(link|script)[^>]+(?:href|src)="([^"]+)"[^>]*>/g,
      (match, tag, url) => {
        if (url.startsWith('/')) {
          return match.replace(url, `${API_BASE_URL}${url}`)
        }
        return match
      }
    )

    return html
  } catch (error) {
    logger.error('资源处理失败', {
      category: LogCategory.TEMPLATE,
      data: { error }
    })
    return html
  }
}

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

interface ApiPagination {
  total: number
  page: number
  pageSize: number
}

interface ApiListResponse<T> {
  items: T[]
  pagination: ApiPagination
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    message: string
    code: string
  }
}

interface TemplateHtml {
  html: string
  id: string
  name: string
  updatedAt: string
}

// 从接口获取预编译的模板
async function getPrecompiledTemplate(templateId: string, articleId: string, articleData: any): Promise<string | null> {
  try {
    const startTime = Date.now()
    logger.info('开始获取模板HTML', {
      category: LogCategory.TEMPLATE,
      data: { 
        templateId, 
        articleId,
        articleTitle: articleData?.title,
        timestamp: new Date().toISOString()
      }
    })

    // 如果没有提供模板ID，直接返回 null
    if (!templateId) {
      logger.warn('未提供模板ID，返回null', {
        category: LogCategory.TEMPLATE,
        data: { articleTitle: articleData?.title }
      })
      return null
    }

    // 只发起一次API请求
    try {
      const response = await apiClient.request<TemplateResponse>({
        method: 'POST',
        url: ApiEndpoints.GET_ARTICLE_TEMPLATES_HTML,
        data: { 
          template_id: templateId, 
          article_id: articleId, 
          article_data: articleData 
        }
      })
      
      if (!response.data?.html) {
        return null
      }

      const templateHtml = response.data
      let processedHtml = templateHtml.html

      // 清理和处理HTML
      processedHtml = sanitizeHtml(processedHtml)
      processedHtml = processResources(processedHtml)

      const endTime = Date.now()
      logger.info('模板HTML处理完成', {
        category: LogCategory.TEMPLATE,
        data: { 
          templateId,
          templateName: templateHtml.name,
          htmlLength: processedHtml.length,
          preview: processedHtml.substring(0, 100) + '...',
          updatedAt: templateHtml.updatedAt,
          processingTime: `${endTime - startTime}ms`
        }
      })
      
      return processedHtml
    } catch (error) {
      logger.warn('API请求失败，返回null', {
        category: LogCategory.TEMPLATE,
        data: { 
          templateId,
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      })
      return null
    }
  } catch (error) {
    logger.error('获取模板HTML失败', {
      category: LogCategory.TEMPLATE,
      data: { 
        templateId,
        error,
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    })
    return null
  }
}

// 获取编译后的模板
export async function getCompiledTemplate(_templateString: string, templateName: string, articleId: string, articleData: any): Promise<string> {
  try {
    // 确保数据中包含 guide 字段
    const templateData = {
      ...articleData,
      guide: articleData.guide || "点击上方蓝字关注我们",
      history: articleData.history || []
    }

    // 从接口获取预编译的模板HTML
    const html = await getPrecompiledTemplate(templateName, articleId, templateData)
    if (html) {
      logger.info('使用接口返回的HTML', {
        category: LogCategory.TEMPLATE,
        data: { 
          templateName,
          htmlLength: html.length,
          articleTitle: templateData.title
        }
      })
      return html
    }

    // 如果接口获取失败，直接使用传入的模板字符串
    logger.warn('接口获取失败，使用本地模板', {
      category: LogCategory.TEMPLATE,
      data: { 
        templateName,
        articleTitle: templateData.title
      }
    })
    
    // 使用传入的模板字符串而不是默认模板
    return renderTemplate(_templateString, templateData)
  } catch (error) {
    logger.error('获取模板失败，使用传入的模板', {
      category: LogCategory.TEMPLATE,
      data: { 
        templateName,
        error,
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        articleTitle: articleData?.title
      }
    })
    return renderTemplate(_templateString, articleData)
  }
}

// 渲染模板
export function renderTemplate(template: string, data: any): string {
  try {
    // 确保数据中包含 guide 字段
    const templateData = {
      ...data,
      guide: data.guide || "点击上方蓝字关注我们",
      history: data.history || []
    }

    // 编译并渲染模板
    const compiledTemplate = Handlebars.compile(template)
    const result = compiledTemplate(templateData)
    
    if (!result) {
      throw new Error('渲染结果为空')
    }

    // 清理和处理HTML
    let processedHtml = sanitizeHtml(result)
    processedHtml = processResources(processedHtml)

    logger.info('本地模板渲染成功', {
      category: LogCategory.TEMPLATE,
      data: { 
        resultLength: processedHtml.length,
        preview: processedHtml.substring(0, 100) + '...',
        hasGuide: !!templateData.guide,
        timestamp: new Date().toISOString()
      }
    })

    return processedHtml
  } catch (error) {
    logger.error('模板渲染失败', {
      category: LogCategory.TEMPLATE,
      data: { 
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    })
    throw error
  }
}

// 修改 validateHtml 函数
function validateHtml(html: string): boolean {
  try {
    // 检查HTML是否为空或只包含空白字符
    if (!html || html.trim().length === 0) {
      return false
    }

    // 检查是否为默认模板
    if (html === DEFAULT_TEMPLATE || html.includes('----没有配置模板----')) {
      return false
    }

    // 检查基本HTML结构
    const hasContent = /<[^>]+>/.test(html)
    if (!hasContent) {
      return false
    }

    // 检查必要的标签
    const hasSection = /<section[^>]*>/.test(html)
    const hasParagraph = /<p[^>]*>/.test(html)
    
    return hasSection && hasParagraph
  } catch (error) {
    logger.error('HTML验证失败', {
      category: LogCategory.TEMPLATE,
      data: { 
        error,
        htmlLength: html?.length,
        preview: html?.substring(0, 100)
      }
    })
    return false
  }
} 