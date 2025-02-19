import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { DEFAULT_TEMPLATE } from "../../types/article"
import { createErrorResponse, createSuccessResponse } from "../../utils/errorHandler"
import { logger, LogCategory } from "../../utils/logger"
import { getCompiledTemplate, renderTemplate } from "../../utils/template"
// @ts-ignore
import Handlebars from "handlebars"

const storage = new Storage()

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

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const requestId = Math.random().toString(36).substring(7)
  const { data: articleData, templateName = 'default', tabId } = req.body

  try {
    if (!articleData) {
      logger.error('文章数据为空', {
        category: LogCategory.ARTICLE,
        data: { requestId }
      })
      return res.send(createErrorResponse(new Error('文章数据为空')))
    }

    logger.info('开始渲染文章', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        title: articleData.title,
        templateName,
        articleData
      }
    })

    // 获取模板内容
    let templateContent = DEFAULT_TEMPLATE
    try {
      const templates = await storage.get<Array<{ name: string; content: string }>>('templates')
      if (templates && Array.isArray(templates)) {
        const template = templates.find(t => t.name === templateName)
        if (template) {
          templateContent = template.content
          logger.info('使用自定义模板', {
            category: LogCategory.ARTICLE,
            data: { 
              requestId,
              templateName,
              contentLength: templateContent.length
            }
          })
        } else {
          logger.warn('未找到指定模板，使用默认模板', {
            category: LogCategory.ARTICLE,
            data: { 
              requestId,
              templateName
            }
          })
        }
      }
    } catch (error) {
      logger.error('获取模板失败，使用默认模板', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          templateName,
          error
        }
      })
    }

    // 渲染模板
    try {
      // 获取预编译的模板
      const compiledTemplate = getCompiledTemplate(templateContent, templateName)
      // 渲染内容
      const html = renderTemplate(compiledTemplate, articleData)

      if (!html) {
        throw new Error('渲染结果为空')
      }

      logger.debug('渲染结果', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          htmlLength: html.length,
          html: html.substring(0, 200) + '...'
        }
      })

      // 使用传入的 tabId 查找标签页
      const tab = await chrome.tabs.get(tabId).catch(() => null)
      
      if (!tab) {
        logger.error('未找到目标标签页', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            tabId
          }
        })
        return res.send(createErrorResponse(new Error('未找到目标标签页')))
      }

      // 检查标签页 URL
      if (!tab.url?.includes('mp.weixin.qq.com')) {
        logger.error('目标页面不是微信公众号编辑器', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            url: tab.url
          }
        })
        return res.send(createErrorResponse(new Error('请在微信公众号编辑器中使用此功能')))
      }

      // 发送渲染消息到内容脚本
      const result = await chrome.tabs.sendMessage(tab.id!, {
        type: 'updateContent',
        content: html
      })

      if (!result?.success) {
        throw new Error(result?.error || '渲染失败')
      }

      logger.info('渲染完成', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          title: articleData.title,
          tabId: tab.id
        }
      })

      return res.send(createSuccessResponse(void 0))
    } catch (error) {
      logger.error('模板渲染失败', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          error,
          templateName,
          articleData
        }
      })
      throw error
    }
  } catch (error) {
    logger.error('渲染文章失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        title: articleData?.title,
        error
      }
    })
    return res.send(createErrorResponse(error))
  }
}

export default handler 