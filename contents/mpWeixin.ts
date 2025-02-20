import type { PlasmoCSConfig } from "plasmo"
import { logger, LogCategory } from "~utils/logger"

export const config: PlasmoCSConfig = {
  matches: ["https://mp.weixin.qq.com/*"],
  all_frames: true,
  world: "MAIN"
}

declare global {
  interface Window {
    __updateResult?: boolean
    __contentScriptReady?: boolean
    UE?: {
      getEditor: (id: string) => {
        setContent: (html: string) => void
        getContent: () => string
        addListener: (event: string, callback: () => void) => void
        ready: (callback: () => void) => void
      }
    }
  }
}

// 连接状态管理
const CONNECTION_STATUS = {
  INITIALIZING: 'initializing',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
}

let connectionStatus = CONNECTION_STATUS.INITIALIZING
let retryCount = 0
const MAX_RETRIES = 3
const RETRY_INTERVAL = 2000

// 初始化标记
let isInitialized = false

// 设置消息监听器
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const requestId = Math.random().toString(36).substring(7)
    
    // 处理 ping 消息
    if (message.type === 'ping') {
      logger.info('收到 ping 请求', {
        category: LogCategory.CONTENT_SCRIPT,
        data: { 
          requestId,
          contentScriptReady: window.__contentScriptReady,
          connectionStatus
        }
      })
      
      sendResponse({ 
        success: window.__contentScriptReady && connectionStatus === CONNECTION_STATUS.CONNECTED,
        status: {
          contentScriptReady: window.__contentScriptReady,
          connectionStatus
        }
      })
      return true
    }

    if (!window.__contentScriptReady) {
      logger.error('内容脚本未就绪', {
        category: LogCategory.CONTENT_SCRIPT,
        data: { 
          requestId,
          messageType: message.type,
          connectionStatus
        }
      })
      sendResponse({ 
        success: false, 
        error: '内容脚本未就绪',
        status: {
          contentScriptReady: false,
          connectionStatus
        }
      })
      return false
    }

    logger.info('收到消息', {
      category: LogCategory.CONTENT_SCRIPT,
      data: { 
        requestId,
        messageType: message.type,
        contentLength: message.content?.length,
        hasTitle: !!message.title,
        connectionStatus
      }
    })

    if (message.type === 'updateContent') {
      handleUpdateContent(message, requestId, sendResponse)
      return true
    }

    return false
  })
}

// 检查编辑器和内容脚本状态
async function checkStatus(): Promise<boolean> {
  try {
    // 检查内容脚本状态
    if (!window.__contentScriptReady || connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      return false
    }

    // 检查编辑器状态
    const editor = await checkEditorReady()
    return !!editor

  } catch (error) {
    return false
  }
}

// 初始化内容脚本
async function initializeContentScript() {
  if (isInitialized) {
    logger.info('内容脚本已经初始化', {
      category: LogCategory.CONTENT_SCRIPT,
      data: {
        status: connectionStatus,
        contentScriptReady: window.__contentScriptReady
      }
    })
    return
  }
  
  const pageLoadId = Math.random().toString(36).substring(7)
  
  try {
    logger.info('内容脚本初始化开始', {
      category: LogCategory.CONTENT_SCRIPT,
      data: {
        pageLoadId,
        url: window.location.href,
        readyState: document.readyState,
        timestamp: new Date().toISOString()
      }
    })

    // 设置消息监听器（最先设置，确保不会错过消息）
    setupMessageListener()

    // 等待页面加载完成
    if (document.readyState !== 'complete') {
      logger.info('等待页面加载完成', {
        category: LogCategory.CONTENT_SCRIPT,
        data: {
          pageLoadId,
          currentState: document.readyState
        }
      })
      await new Promise(resolve => window.addEventListener('load', resolve, { once: true }))
    }

    // 记录页面环境信息
    logger.info('页面环境信息', {
      category: LogCategory.CONTENT_SCRIPT,
      data: {
        pageLoadId,
        url: window.location.href,
        readyState: document.readyState,
        userAgent: navigator.userAgent,
        windowSize: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        },
        compatMode: document.compatMode
      }
    })

    // 设置初始状态
    window.__contentScriptReady = true
    isInitialized = true
    connectionStatus = CONNECTION_STATUS.CONNECTED

    logger.info('内容脚本初始化完成', {
      category: LogCategory.CONTENT_SCRIPT,
      data: {
        pageLoadId,
        status: connectionStatus,
        timestamp: new Date().toISOString(),
        documentReady: document.readyState === 'complete',
        domContentLoaded: document.readyState !== 'loading'
      }
    })

    // 开始监听编辑器状态
    startEditorMonitoring(pageLoadId)

    // 定期检查状态
    startStatusChecking(pageLoadId)
  } catch (error) {
    connectionStatus = CONNECTION_STATUS.ERROR
    logger.error('内容脚本初始化失败', {
      category: LogCategory.CONTENT_SCRIPT,
      data: {
        pageLoadId,
        error,
        retryCount,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        documentState: document.readyState,
        windowState: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight
        }
      }
    })

    // 重试逻辑
    if (retryCount < MAX_RETRIES) {
      retryCount++
      logger.info('准备重试初始化', {
        category: LogCategory.CONTENT_SCRIPT,
        data: {
          pageLoadId,
          retryCount,
          maxRetries: MAX_RETRIES,
          retryInterval: RETRY_INTERVAL
        }
      })
      setTimeout(initializeContentScript, RETRY_INTERVAL)
    } else {
      logger.error('初始化重试次数已达上限', {
        category: LogCategory.CONTENT_SCRIPT,
        data: {
          pageLoadId,
          retryCount,
          maxRetries: MAX_RETRIES
        }
      })
    }
  }
}

// 定期检查状态
function startStatusChecking(pageLoadId: string) {
  const CHECK_INTERVAL = 5000 // 5秒检查一次
  const MAX_CHECKS = 60 // 最多检查5分钟
  let checkCount = 0

  const checkStatus = () => {
    const status = {
      contentScriptReady: window.__contentScriptReady,
      connectionStatus,
      documentReady: document.readyState === 'complete',
      timestamp: new Date().toISOString()
    }

    logger.debug('状态检查', {
      category: LogCategory.CONTENT_SCRIPT,
      data: {
        pageLoadId,
        checkCount,
        ...status
      }
    })

    checkCount++
    if (checkCount < MAX_CHECKS) {
      setTimeout(checkStatus, CHECK_INTERVAL)
    }
  }

  // 开始检查
  checkStatus()
}

// 检查编辑器状态
async function checkEditorReady(maxAttempts = 10, interval = 1000): Promise<boolean> {
  logger.info('开始检查编辑器状态', {
    category: LogCategory.ARTICLE,
    data: { maxAttempts, interval }
  })

  let attempts = 0
  
  while (attempts < maxAttempts) {
    try {
      // 检查编辑器容器
      const editorContainer = document.querySelector('#js_editor')
      if (!editorContainer) {
        logger.debug('未找到编辑器容器', {
          category: LogCategory.ARTICLE,
          data: { attempts }
        })
        await new Promise(resolve => setTimeout(resolve, interval))
        attempts++
        continue
      }

      // 检查 ProseMirror 编辑器
      const proseMirror = document.querySelector('.ProseMirror') as HTMLElement
      if (!proseMirror) {
        logger.debug('未找到 ProseMirror 编辑器', {
          category: LogCategory.ARTICLE,
          data: { attempts }
        })
        await new Promise(resolve => setTimeout(resolve, interval))
        attempts++
        continue
      }

      // 检查编辑器是否可编辑
      if (!proseMirror.hasAttribute('contenteditable')) {
        logger.debug('编辑器不可编辑', {
          category: LogCategory.ARTICLE,
          data: { attempts }
        })
        await new Promise(resolve => setTimeout(resolve, interval))
        attempts++
        continue
      }

      logger.info('编辑器已就绪', {
        category: LogCategory.ARTICLE,
        data: { attempts }
      })
      return true

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

// 监听编辑器状态
function startEditorMonitoring(pageLoadId: string) {
  let monitorCount = 0
  const MAX_MONITOR_COUNT = 50
  const MONITOR_INTERVAL = 200

  // 监听来自注入脚本的消息
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return

    const { type, data, error } = event.data || {}

    switch (type) {
      case 'EDITOR_DOM_FOUND':
        logger.info('找到编辑器DOM元素', {
          category: LogCategory.CONTENT_SCRIPT,
          data: {
            pageLoadId,
            elements: data.elements
          }
        })
        break

      case 'EDITOR_ERROR':
        logger.error('编辑器检测错误', {
          category: LogCategory.CONTENT_SCRIPT,
          data: {
            pageLoadId,
            error
          }
        })
        break
    }
  })

  // 定期检查编辑器状态
  function monitorEditor() {
    if (monitorCount >= MAX_MONITOR_COUNT) return

    monitorCount++
    const editor = document.querySelector('#ueditor_0, .rich_edit_iframe, .edui-editor-iframe')
    if (editor) {
      logger.info('找到编辑器元素', {
        category: LogCategory.CONTENT_SCRIPT,
        data: {
          pageLoadId,
          monitorCount,
          editorType: editor.tagName,
          editorId: editor.id,
          editorClass: editor.className
        }
      })
      return
    }

    setTimeout(monitorEditor, MONITOR_INTERVAL)
  }

  monitorEditor()
}

// 处理更新内容的消息
async function handleUpdateContent(message: any, requestId: string, sendResponse: (response: any) => void) {
  try {
    logger.info('开始处理更新内容请求', {
      category: LogCategory.CONTENT_SCRIPT,
      data: { 
        requestId,
        contentLength: message.content?.length,
        hasTitle: !!message.title,
        contentScriptReady: window.__contentScriptReady,
        connectionStatus,
        documentReady: document.readyState === 'complete'
      }
    })

    if (!message.content) {
      throw new Error('更新内容为空')
    }

    // 更新内容
    const success = await updateEditorContent(message.content, message.title)
    if (success) {
      logger.info('内容更新成功', {
        category: LogCategory.CONTENT_SCRIPT,
        data: { 
          requestId,
          title: message.title,
          contentLength: message.content.length,
        }
      })
      sendResponse({ success: true })
    } else {
      const error = new Error('更新内容失败')
      logger.error('内容更新失败', {
        category: LogCategory.CONTENT_SCRIPT,
        data: { 
          requestId,
          error,
          contentLength: message.content.length
        }
      })
      throw error
    }
  } catch (error) {
    logger.error('内容更新处理失败', {
      category: LogCategory.CONTENT_SCRIPT,
      data: { 
        requestId,
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        status: {
          contentScriptReady: window.__contentScriptReady,
          connectionStatus,
          documentReady: document.readyState === 'complete'
        }
      }
    })
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

// 更新编辑器内容
async function updateEditorContent(html: string, title?: string): Promise<boolean> {
  const requestId = Math.random().toString(36).substring(7)
  const maxRetries = 3
  let retryCount = 0
  
  async function tryUpdate(): Promise<boolean> {
    try {
      logger.info('尝试更新编辑器内容', {
        category: LogCategory.CONTENT_SCRIPT,
        data: { 
          requestId,
          retryCount,
          contentLength: html.length,
          hasTitle: !!title,
          timestamp: new Date().toISOString()
        }
      })

      // 更新标题
      if (title) {
        const titleResult = await updateTitle(title, requestId)
        if (!titleResult) {
          logger.warn('标题更新失败，继续更新内容', {
            category: LogCategory.CONTENT_SCRIPT,
            data: { requestId, title }
          })
        }
      }

      // 等待编辑器就绪
      const isEditorReady = await checkEditorReady()
      if (!isEditorReady) {
        throw new Error('编辑器未就绪')
      }

      // 获取 ProseMirror 编辑器
      const proseMirror = document.querySelector('.ProseMirror') as HTMLElement
      if (!proseMirror) {
        throw new Error('未找到 ProseMirror 编辑器')
      }

      // 清理和格式化HTML内容
      const cleanHtml = sanitizeHtml(html)

      // 更新内容前先聚焦编辑器
      proseMirror.focus()

      // 更新内容
      proseMirror.innerHTML = cleanHtml

      // 触发完整的事件序列
      const events = [
        new Event('focus', { bubbles: true }),
        new InputEvent('input', { bubbles: true, cancelable: true }),
        new Event('change', { bubbles: true }),
        new KeyboardEvent('keyup', { bubbles: true }),
        new Event('blur', { bubbles: true })
      ]

      // 按顺序触发事件
      for (const event of events) {
        await new Promise(resolve => setTimeout(resolve, 100))
        proseMirror.dispatchEvent(event)
      }

      // 等待一下确保更新完成
      await new Promise(resolve => setTimeout(resolve, 500))

      // 验证内容更新
      const contentVerified = await verifyContent(proseMirror, cleanHtml, requestId)
      if (!contentVerified) {
        throw new Error('内容验证失败')
      }

      // 触发自动保存
      const saveButton = document.querySelector('.weui-desktop-btn_primary') as HTMLElement
      if (saveButton) {
        saveButton.click()
      }

      logger.info('编辑器内容更新成功', {
        category: LogCategory.CONTENT_SCRIPT,
        data: { 
          requestId,
          retryCount,
          contentLength: cleanHtml.length,
          timestamp: new Date().toISOString()
        }
      })

      return true
    } catch (error) {
      logger.error('更新编辑器内容失败', {
        category: LogCategory.CONTENT_SCRIPT,
        data: { 
          requestId,
          retryCount,
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      })

      if (retryCount < maxRetries) {
        retryCount++
        await new Promise(resolve => setTimeout(resolve, 2000))
        return tryUpdate()
      }

      return false
    }
  }

  return tryUpdate()
}

// 清理HTML内容
function sanitizeHtml(html: string): string {
  // 1. 移除多余的空白字符
  let cleanHtml = html
    .replace(/[\r\n\t]+/g, '') // 移除换行和制表符
    .replace(/\s{2,}/g, ' ') // 多个空格替换为单个空格
    .trim()

  // 2. 处理特殊字符
  cleanHtml = cleanHtml
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  // 3. 处理样式属性
  cleanHtml = cleanHtml.replace(/style=(["'])(.*?)\1/g, (match, quote, styles) => {
    if (!styles) return ''
    
    try {
      // 移除所有引号和可能导致问题的字符
      styles = styles
        .replace(/["']/g, '')  // 移除引号
        .replace(/\\./g, '')   // 移除转义序列
        .trim()
      
      if (!styles) return ''

      // 解析并验证每个样式属性
      const validStyles = styles
        .split(';')
        .map(style => {
          const [prop, ...values] = style.split(':').map(s => s.trim())
          const value = values.join(':').trim() // 重新组合可能包含冒号的值
          
          // 验证属性名和值
          if (!prop || !value) return null
          if (!/^[a-zA-Z0-9-]+$/.test(prop)) return null // 只允许字母、数字和连字符
          if (/["'\\]/.test(value)) return null // 不允许引号和反斜杠
          
          return `${prop}: ${value}`
        })
        .filter(Boolean)
        .join('; ')

      return validStyles ? `style=${quote}${validStyles}${quote}` : ''
    } catch (error) {
      logger.warn('样式处理失败', {
        category: LogCategory.CONTENT_SCRIPT,
        data: { 
          originalStyles: styles,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return ''
    }
  })

  // 4. 处理所有带有样式的标签
  const styleTagPattern = /<([a-zA-Z0-9-]+)([^>]*?)style=(["'])(.*?)\3([^>]*)>/g
  cleanHtml = cleanHtml.replace(styleTagPattern, (match, tag, beforeStyle, quote, styles, afterStyle) => {
    if (!styles) return `<${tag}${beforeStyle}${afterStyle}>`
    
    try {
      // 移除所有引号和可能导致问题的字符
      styles = styles
        .replace(/["']/g, '')  // 移除引号
        .replace(/\\./g, '')   // 移除转义序列
        .trim()
      
      if (!styles) return `<${tag}${beforeStyle}${afterStyle}>`

      // 解析并验证每个样式属性
      const validStyles = styles
        .split(';')
        .map(style => {
          const [prop, ...values] = style.split(':').map(s => s.trim())
          const value = values.join(':').trim() // 重新组合可能包含冒号的值
          
          // 验证属性名和值
          if (!prop || !value) return null
          if (!/^[a-zA-Z0-9-]+$/.test(prop)) return null // 只允许字母、数字和连字符
          if (/["'\\]/.test(value)) return null // 不允许引号和反斜杠
          
          return `${prop}: ${value}`
        })
        .filter(Boolean)
        .join('; ')

      return validStyles 
        ? `<${tag}${beforeStyle}style=${quote}${validStyles}${quote}${afterStyle}>`
        : `<${tag}${beforeStyle}${afterStyle}>`
    } catch (error) {
      logger.warn('标签样式处理失败', {
        category: LogCategory.CONTENT_SCRIPT,
        data: { 
          tag,
          originalStyles: styles,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return `<${tag}${beforeStyle}${afterStyle}>`
    }
  })

  // 5. 处理图片
  cleanHtml = cleanHtml.replace(/<img([^>]*)>/g, (match, attrs) => {
    // 处理图片属性
    let imgAttrs = attrs
      .replace(/\s+/g, ' ')
      .replace(/\s*=\s*/g, '=')
      .replace(/"\s+/g, '" ')
      .trim()

    // 添加必要的类名
    if (!/\sclass=/.test(imgAttrs)) {
      imgAttrs += ' class="rich_pages js_insertlocalimg"'
    } else if (!imgAttrs.includes('js_insertlocalimg')) {
      imgAttrs = imgAttrs.replace(/class=(["'])([^"']*)\1/, (m, q, c) => 
        `class=${q}${c} js_insertlocalimg${q}`)
    }

    // 处理图片链接
    if (imgAttrs.includes('src=')) {
      imgAttrs = imgAttrs.replace(/src=(["'])([^"']+)\1/g, (srcMatch, quote, src) => {
        if (src.startsWith('data:')) {
          return srcMatch
        }
        // 使用相对协议的URL
        const cleanSrc = src.replace(/^https?:/, '')
        return `src=${quote}${cleanSrc}${quote} data-src=${quote}${cleanSrc}${quote}`
      })
    }

    // 添加微信编辑器所需的属性
    const requiredAttrs = {
      'data-ratio': '1.0',
      'data-w': '750',
      'data-type': 'jpeg',
      'data-fail': '0',
      'crossorigin': 'anonymous',
      'data-copyright': '0',
      'data-s': '300,640',
      'data-fileid': '',
      'data-local': '0'
    }

    // 添加缺失的属性
    Object.entries(requiredAttrs).forEach(([key, value]) => {
      if (!imgAttrs.includes(`${key}=`)) {
        imgAttrs += ` ${key}="${value}"`
      }
    })

    return `<img ${imgAttrs}>`
  })

  // 6. 处理段落和文本节点
  cleanHtml = cleanHtml
    // 确保段落有正确的样式
    .replace(/<p([^>]*)>/g, (match, attrs) => {
      const hasStyle = /style=/i.test(attrs)
      const baseStyle = 'margin: 0px; padding: 0px; max-width: 100%; box-sizing: border-box; clear: both; min-height: 1em;'
      if (!hasStyle) {
        return `<p style="${baseStyle}"${attrs}>`
      }
      return match
    })
    // 处理 section 标签
    .replace(/<section([^>]*)>/g, (match, attrs) => {
      const hasStyle = /style=/i.test(attrs)
      const baseStyle = 'margin: 0px; padding: 0px; max-width: 100%; box-sizing: border-box;'
      if (!hasStyle) {
        return `<section style="${baseStyle}"${attrs}>`
      }
      return match
    })

  // 6. 确保内容在 section 标签内
  if (!cleanHtml.includes('<section')) {
    cleanHtml = `<section style="margin: 0px; padding: 0px; max-width: 100%; box-sizing: border-box;">${cleanHtml}</section>`
  }

  return cleanHtml
}

// 验证内容是否更新成功
async function verifyContent(
  editorElement: HTMLElement,
  expectedHtml: string,
  requestId: string
): Promise<boolean> {
  try {
    const currentContent = editorElement.innerHTML
    
    if (!currentContent) {
      throw new Error('内容更新后为空')
    }

    // 简单的长度验证
    const contentLength = currentContent.length
    const expectedLength = expectedHtml.length
    const lengthDiff = Math.abs(contentLength - expectedLength)
    const lengthThreshold = expectedLength * 0.1 // 允许10%的差异

    if (lengthDiff > lengthThreshold) {
      logger.warn('内容长度差异较大', {
        category: LogCategory.CONTENT_SCRIPT,
        data: {
          requestId,
          contentLength,
          expectedLength,
          lengthDiff,
          threshold: lengthThreshold
        }
      })
    }

    return true
  } catch (error) {
    logger.error('内容验证失败', {
      category: LogCategory.CONTENT_SCRIPT,
      data: {
        requestId,
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    })
    return false
  }
}

// 更新标题
async function updateTitle(title: string, requestId: string): Promise<boolean> {
  try {
    // 尝试多个可能的标题输入框选择器
    const titleSelectors = [
      'input[name="title"]',
      '#title',
      'input.title-input',
      'input[placeholder*="标题"]',
      'input.weui-desktop-form__input'
    ]
    
    let titleInput: HTMLInputElement | null = null
    for (const selector of titleSelectors) {
      titleInput = document.querySelector(selector)
      if (titleInput) break
    }

    if (!titleInput) {
      // 如果没有找到输入框，尝试创建一个
      const possibleContainers = [
        '.title-container',
        '.weui-desktop-form__title',
        '#title-container'
      ]
      
      let container = null
      for (const selector of possibleContainers) {
        container = document.querySelector(selector)
        if (container) break
      }

      if (container) {
        titleInput = document.createElement('input')
        titleInput.type = 'text'
        titleInput.className = 'title-input'
        titleInput.placeholder = '请输入标题'
        container.appendChild(titleInput)
      } else {
        throw new Error('未找到标题容器')
      }
    }

    // 更新标题值
    titleInput.value = title
    
    // 触发多个事件以确保更新
    const events = ['input', 'change', 'blur', 'keyup']
    events.forEach(eventType => {
      titleInput!.dispatchEvent(new Event(eventType, { bubbles: true }))
    })

    // 等待一下确保更新完成
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 验证更新
    if (titleInput.value !== title) {
      throw new Error('标题更新验证失败')
    }

    logger.info('标题更新成功', {
      category: LogCategory.CONTENT_SCRIPT,
      data: { 
        requestId,
        title,
        selector: titleInput.matches(titleSelectors.join(','))
      }
    })

    return true
  } catch (error) {
    logger.warn('标题更新失败', {
      category: LogCategory.CONTENT_SCRIPT,
      data: { 
        requestId,
        error,
        title,
        availableInputs: Array.from(document.querySelectorAll('input'))
          .map(input => ({
            name: input.name,
            id: input.id,
            class: input.className,
            type: input.type,
            placeholder: input.placeholder
          }))
      }
    })
    return false
  }
}

// 立即初始化
initializeContentScript()

// 监听页面卸载
window.addEventListener('unload', () => {
  connectionStatus = CONNECTION_STATUS.DISCONNECTED
  window.__contentScriptReady = false
  logger.info('内容脚本已卸载', {
    category: LogCategory.CONTENT_SCRIPT,
    data: {
      url: window.location.href,
      timestamp: new Date().toISOString()
    }
  })
})




