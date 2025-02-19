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
  
  while (attempts < maxAttempts) {
    try {
      const editor = document.querySelector('iframe.rich_edit_iframe') as HTMLIFrameElement
      if (editor) {
        logger.info('找到编辑器', {
          category: LogCategory.ARTICLE,
          data: { attempts }
        })
        return editor
      }
      
      logger.debug(`等待编辑器就绪 (${attempts + 1}/${maxAttempts})`, {
        category: LogCategory.ARTICLE
      })
      
      await new Promise(resolve => setTimeout(resolve, interval))
      attempts++
    } catch (error) {
      logger.error('检查编辑器就绪失败', {
        category: LogCategory.ARTICLE,
        data: { error, attempts }
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
const updateEditorContent = async (content: string): Promise<boolean> => {
  try {
    const editor = await checkEditorReady()
    if (!editor?.contentWindow?.document) {
      throw new Error('编辑器未就绪')
    }

    // 更新编辑器内容
    const editorDoc = editor.contentWindow.document
    
    // 确保内容区域存在
    const contentArea = editorDoc.querySelector('.rich_media_content') || editorDoc.body
    if (!contentArea) {
      throw new Error('找不到内容区域')
    }

    // 清理现有内容
    contentArea.innerHTML = ''

    // 创建临时容器来解析 HTML
    const tempContainer = editorDoc.createElement('div')
    tempContainer.innerHTML = content

    // 处理图片
    const images = tempContainer.getElementsByTagName('img')
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      if (img.src) {
        // 确保图片链接是 HTTPS
        img.src = img.src.replace(/^http:/, 'https:')
        // 添加图片加载错误处理
        img.onerror = () => {
          logger.warn('图片加载失败', {
            category: LogCategory.ARTICLE,
            data: { src: img.src }
          })
        }
      }
    }

    // 将处理后的内容添加到编辑器
    contentArea.appendChild(tempContainer)

    logger.info('编辑器内容已更新', {
      category: LogCategory.ARTICLE,
      data: { 
        contentLength: content.length,
        timestamp: new Date().toISOString()
      }
    })

    return true
  } catch (error) {
    logger.error('更新编辑器内容失败', {
      category: LogCategory.ARTICLE,
      data: { 
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    })
    return false
  }
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
    if (message.type === 'updateContent') {
      updateEditorContent(message.content)
        .then(success => {
          if (success) {
            sendResponse({ success: true })
          } else {
            sendResponse({ 
              success: false, 
              error: '更新编辑器内容失败'
            })
          }
        })
        .catch(error => sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        }))
      return true // 保持消息通道开启
    }
  })
})
