import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { DEFAULT_TEMPLATE } from "../../types/article"
import { createErrorResponse, createSuccessResponse } from "../../utils/errorHandler"
import { logger, LogCategory } from "../../utils/logger"
import { getCompiledTemplate, renderTemplate } from "../../utils/template"
import Handlebars from "handlebars/runtime"

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

// 验证HTML内容
function validateHtml(html: string): boolean {
  // 检查HTML是否为空或只包含空白字符
  if (!html || html.trim().length === 0) {
    return false
  }

  // 检查基本HTML结构
  const hasContent = /<[^>]+>/.test(html)
  if (!hasContent) {
    return false
  }

  return true
}

// 等待内容脚本就绪
async function waitForContentScript(tabId: number, maxAttempts = 5): Promise<boolean> {
  const interval = 1000
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' })
      
      logger.debug('内容脚本状态检查', {
        category: LogCategory.ARTICLE,
        data: { 
          attempts,
          tabId,
          response
        }
      })

      if (response?.success) {
        logger.info('内容脚本就绪', {
          category: LogCategory.ARTICLE,
          data: { 
            attempts,
            tabId,
            status: response.status
          }
        })
        return true
      }

      // 如果收到响应但未就绪，记录状态
      if (response?.status) {
        logger.warn('内容脚本未完全就绪', {
          category: LogCategory.ARTICLE,
          data: { 
            attempts,
            tabId,
            status: response.status
          }
        })
      }
    } catch (error) {
      logger.debug('等待内容脚本就绪', {
        category: LogCategory.ARTICLE,
        data: { 
          attempts,
          tabId,
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }
    
    await new Promise(resolve => setTimeout(resolve, interval))
    attempts++
  }

  logger.error('内容脚本就绪超时', {
    category: LogCategory.ARTICLE,
    data: { 
      attempts,
      tabId,
      maxAttempts
    }
  })

  return false
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const requestId = Math.random().toString(36).substring(7)
  const { data: articleData, templateName = 'default', tabId } = req.body

  logger.info('收到渲染请求', {
    category: LogCategory.ARTICLE,
    data: { 
      requestId,
      tabId,
      templateName,
      articleTitle: articleData?.title
    }
  })

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
      const startTime = Date.now()
      // 获取预编译的模板
      const html = await getCompiledTemplate(
        templateContent, 
        templateName, 
        "493da9bf-a6d3-405c-b026-bec203fb2b9c", 
        articleData
      )

      // 验证HTML内容
      if (!validateHtml(html)) {
        throw new Error('渲染结果不是有效的HTML内容')
      }

      const endTime = Date.now()
      logger.debug('渲染结果', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          htmlLength: html.length,
          preview: html.substring(0, 200) + '...',
          renderTime: `${endTime - startTime}ms`
        }
      })

      // 如果没有提供 tabId，直接返回渲染结果
      if (!tabId) {
        logger.info('无 tabId，直接返回渲染结果', {
          category: LogCategory.ARTICLE,
          data: { requestId }
        })
        return res.send(createSuccessResponse({ html }))
      }

      try {
        logger.info('开始查询标签页', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            providedTabId: tabId
          }
        })

        // 查询标签页
        const tab = await chrome.tabs.get(tabId)
        
        if (!tab || !tab.url?.includes('mp.weixin.qq.com')) {
          throw new Error('请在微信公众号编辑器中使用此功能')
        }

        // 等待内容脚本就绪
        const isContentScriptReady = await waitForContentScript(tabId)
        if (!isContentScriptReady) {
          throw new Error('内容脚本未就绪，请刷新页面重试')
        }

        logger.info('查询到的标签页', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            tabInfo: {
              id: tab.id,
              url: tab.url,
              active: tab.active,
              windowId: tab.windowId
            }
          }
        })
        
        if (!tab || !tab.id) {
          logger.error('未找到目标标签页', {
            category: LogCategory.ARTICLE,
            data: { 
              requestId,
              providedTabId: tabId,
              tab
            }
          })
          return res.send(createErrorResponse(new Error('未找到目标标签页')))
        }

        logger.info('准备发送消息到内容脚本', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            tabId: tab.id,
            url: tab.url
          }
        })

        // 发送渲染消息到内容脚本
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'updateContent',
          content: html,
          title: articleData.title
        })

        logger.info('内容脚本响应', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            result
          }
        })

        if (!result?.success) {
          throw new Error(result?.error || '渲染失败')
        }

        logger.info('渲染完成', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            title: articleData.title,
            tabId: tab.id,
            totalTime: `${Date.now() - startTime}ms`
          }
        })

        return res.send(createSuccessResponse(void 0))
      } catch (error) {
        logger.error('与内容脚本通信失败', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            error,
            errorMessage: error.message,
            errorStack: error.stack
          }
        })
        // 返回渲染的 HTML，让调用方自行处理
        return res.send(createSuccessResponse({ html }))
      }
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