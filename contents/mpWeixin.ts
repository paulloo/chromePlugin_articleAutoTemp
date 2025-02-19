import type { PlasmoCSConfig } from "plasmo"
import { logger, LogCategory } from "~utils/logger"

export const config: PlasmoCSConfig = {
  matches: ["https://mp.weixin.qq.com/*"]
}

// 编辑器状态检查
const checkEditorReady = async (maxAttempts = 10, interval = 1000): Promise<HTMLIFrameElement | null> => {
  logger.info('开始检查编辑器状态', {
    category: LogCategory.ARTICLE,
    data: { maxAttempts, interval }
  })

  let attempts = 0
  
  // 可能的编辑器选择器
  const editorSelectors = [
    'iframe.rich_edit_iframe',                // 默认选择器
    '#ueditor_0',                            // UEditor 默认 ID
    'iframe.edui-editor-iframe',             // UEditor iframe
    'iframe#editor_iframe',                  // 通用编辑器 iframe
    'iframe[name="editorContainer"]',        // 编辑器容器
    'iframe.weui-desktop-editor__editing-area' // 微信编辑器特定类
  ]
  
  while (attempts < maxAttempts) {
    try {
      // 记录当前页面上所有的 iframe
      const allIframes = document.querySelectorAll('iframe')
      logger.debug('当前页面 iframe 信息', {
        category: LogCategory.ARTICLE,
        data: { 
          attempts,
          iframeCount: allIframes.length,
          iframeDetails: Array.from(allIframes).map(iframe => ({
            id: iframe.id,
            className: iframe.className,
            name: iframe.name,
            src: iframe.src
          }))
        }
      })

      // 尝试所有可能的选择器
      for (const selector of editorSelectors) {
        const editor = document.querySelector(selector) as HTMLIFrameElement
        if (editor) {
          logger.info('找到编辑器', {
            category: LogCategory.ARTICLE,
            data: { 
              attempts,
              matchedSelector: selector,
              editorDetails: {
                id: editor.id,
                className: editor.className,
                name: editor.name,
                src: editor.src
              }
            }
          })
          return editor
        }
      }
      
      // 如果所有选择器都失败，记录当前 DOM 结构
      if (attempts === 0 || attempts === maxAttempts - 1) {
        logger.debug('当前页面 DOM 结构', {
          category: LogCategory.ARTICLE,
          data: { 
            attempts,
            bodyHTML: document.body.innerHTML.substring(0, 1000) + '...',
            availableClasses: Array.from(document.querySelectorAll('*'))
              .map(el => el.className)
              .filter(Boolean)
              .join(', ')
          }
        })
      }
      
      logger.debug(`等待编辑器就绪 (${attempts + 1}/${maxAttempts})`, {
        category: LogCategory.ARTICLE,
        data: {
          attempts,
          timestamp: new Date().toISOString()
        }
      })
      
      await new Promise(resolve => setTimeout(resolve, interval))
      attempts++
    } catch (error) {
      logger.error('检查编辑器就绪失败', {
        category: LogCategory.ARTICLE,
        data: { 
          error,
          attempts,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        }
      })
      throw error
    }
  }
  
  throw new Error('编辑器加载超时')
}

// 处理数据
const processContent = async (content: string) => {
  try {
    logger.info('开始处理内容', {
      category: LogCategory.ARTICLE,
      data: { 
        contentLength: content.length,
        timestamp: new Date().toISOString()
      }
    })

    // 发送消息到后台进行处理
    const response = await chrome.runtime.sendMessage({
      type: 'processData',
      data: content
    })

    if (response.type === 'error') {
      throw new Error(response.error)
    }

    logger.info('内容处理完成', {
      category: LogCategory.ARTICLE,
      data: { 
        result: response.data,
        timestamp: new Date().toISOString()
      }
    })

    return response.data.originalData
  } catch (error) {
    logger.error('内容处理失败', {
      category: LogCategory.ARTICLE,
      data: { 
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    })
    throw error
  }
}

// 更新编辑器内容
const updateEditorContent = async (content: string, title?: string): Promise<boolean> => {
  const requestId = Math.random().toString(36).substring(7)
  let retryCount = 0
  const maxRetries = 3
  const retryDelay = 1000

  const tryUpdate = async (): Promise<boolean> => {
    try {
      logger.info('开始更新编辑器内容', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          attempt: retryCount + 1,
          contentLength: content.length,
          hasTitle: !!title,
          timestamp: new Date().toISOString()
        }
      })

      const editor = await checkEditorReady()
      
      // 如果提供了标题，先更新标题
      if (title) {
        try {
          const titleInput = document.querySelector('#title') as HTMLTextAreaElement
          const titlePlace = document.querySelector('.js_title_place') as HTMLElement
          
          if (titleInput && titlePlace) {
            logger.info('更新文章标题', {
              category: LogCategory.ARTICLE,
              data: { 
                requestId,
                title,
                timestamp: new Date().toISOString()
              }
            })

            // 更新标题输入框
            titleInput.value = title
            // 更新预览文本
            titlePlace.textContent = title
            
            // 触发输入事件
            const inputEvent = new Event('input', { bubbles: true })
            titleInput.dispatchEvent(inputEvent)
            
            // 触发变更事件
            const changeEvent = new Event('change', { bubbles: true })
            titleInput.dispatchEvent(changeEvent)
          } else {
            logger.warn('未找到标题输入元素', {
              category: LogCategory.ARTICLE,
              data: { 
                requestId,
                titleInputExists: !!titleInput,
                titlePlaceExists: !!titlePlace
              }
            })
          }
        } catch (error) {
          logger.error('更新标题失败', {
            category: LogCategory.ARTICLE,
            data: { 
              requestId,
              error,
              title
            }
          })
        }
      }

      logger.debug('获取到编辑器元素', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          editorType: editor.tagName.toLowerCase(),
          editorId: editor.id,
          editorClass: editor.className
        }
      })

      // 根据编辑器类型获取文档对象
      let editorDoc: Document
      let contentArea: Element | null

      if (editor instanceof HTMLIFrameElement && editor.contentWindow?.document) {
        // iframe 类型编辑器
        editorDoc = editor.contentWindow.document
        contentArea = editorDoc.querySelector('.rich_media_content')
      } else {
        // div 类型编辑器
        editorDoc = document
        contentArea = editor.querySelector('.rich_media_content') || editor
      }

      if (!contentArea) {
        logger.error('找不到内容区域', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            editorType: editor.tagName.toLowerCase(),
            availableClasses: Array.from(editor.querySelectorAll('*')).map(el => el.className).join(', ')
          }
        })
        throw new Error('找不到内容区域')
      }

      // 清理现有内容前记录状态
      logger.debug('清理前的内容状态', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          originalContent: contentArea.innerHTML.substring(0, 100) + '...',
          originalLength: contentArea.innerHTML.length
        }
      })

      // 清理现有内容
      contentArea.innerHTML = ''

      // 创建临时容器来解析 HTML
      const tempContainer = document.createElement('div')
      tempContainer.innerHTML = content

      // 处理图片
      const images = tempContainer.getElementsByTagName('img')
      logger.info('处理图片元素', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          imageCount: images.length
        }
      })

      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        if (img.src) {
          // 确保图片链接是 HTTPS
          img.src = img.src.replace(/^http:/, 'https:')
          // 添加图片加载错误处理
          img.onerror = () => {
            logger.warn('图片加载失败', {
              category: LogCategory.ARTICLE,
              data: { 
                requestId,
                src: img.src,
                index: i
              }
            })
          }
        }
      }

      // 将处理后的内容添加到编辑器
      while (tempContainer.firstChild) {
        contentArea.appendChild(tempContainer.firstChild)
      }

      // 验证内容是否成功更新
      if (contentArea.innerHTML.length === 0) {
        throw new Error('内容更新后为空')
      }

      // 触发内容更改事件
      try {
        const event = new Event('input', { bubbles: true })
        contentArea.dispatchEvent(event)
      } catch (error) {
        logger.warn('触发内容更改事件失败', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            error
          }
        })
      }

      logger.info('编辑器内容已更新', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          contentLength: contentArea.innerHTML.length,
          timestamp: new Date().toISOString()
        }
      })

      return true
    } catch (error) {
      logger.error('更新编辑器内容失败', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          attempt: retryCount + 1,
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        }
      })

      if (retryCount < maxRetries) {
        retryCount++
        logger.info('准备重试更新内容', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            nextAttempt: retryCount + 1,
            delay: retryDelay
          }
        })
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return tryUpdate()
      }

      return false
    }
  }

  return tryUpdate()
}

// 页面加载完成后初始化
window.addEventListener('load', () => {
  const pageLoadId = Math.random().toString(36).substring(7)
  
  logger.info('页面加载完成', {
    category: LogCategory.ARTICLE,
    data: {
      pageLoadId,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      windowSize: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }
  })

  // 监听来自插件的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const requestId = Math.random().toString(36).substring(7)
    
    logger.info('收到消息', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        messageType: message.type,
        sender,
        timestamp: new Date().toISOString()
      }
    })

    if (message.type === 'updateContent') {
      logger.info('开始处理更新内容请求', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          contentLength: message.content?.length,
          hasTitle: !!message.title,
          timestamp: new Date().toISOString()
        }
      })

      if (!message.content) {
        const error = new Error('更新内容为空')
        logger.error('更新内容为空', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            message,
            error
          }
        })
        sendResponse({ 
          success: false, 
          error: error.message 
        })
        return true
      }

      updateEditorContent(message.content, message.title)
        .then(success => {
          logger.info('更新内容处理完成', {
            category: LogCategory.ARTICLE,
            data: { 
              requestId,
              success,
              timestamp: new Date().toISOString()
            }
          })

          if (success) {
            sendResponse({ success: true })
          } else {
            const error = new Error('更新编辑器内容失败')
            logger.error('更新失败', {
              category: LogCategory.ARTICLE,
              data: { 
                requestId,
                error
              }
            })
            sendResponse({ 
              success: false, 
              error: error.message
            })
          }
        })
        .catch(error => {
          logger.error('更新内容时发生错误', {
            category: LogCategory.ARTICLE,
            data: { 
              requestId,
              error,
              errorType: typeof error,
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined
            }
          })
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error)
          })
        })
      return true // 保持消息通道开启
    }
  })
})


