import { unescape } from "querystring"
import axios from "axios"
// @ts-ignore
import Handlebars from "handlebars"
import type { ArticleData } from '../types/article'

function filterReference(htmlString) {
  if (!htmlString) {
    return ""
  }

  // // 创建一个 DOMParser 实例
  // const parser = new DOMParser();
  // // 将 HTML 字符串解析成 DOM 对象
  // const doc = parser.parseFromString(htmlString, 'text/html');
  // // 获取所有 class 为 'reference' 的 sup 标签
  // const sups = doc.querySelectorAll('sup.reference');
  // // 遍历并移除找到的 sup 标签
  // sups.forEach(sup => sup.parentNode.removeChild(sup));
  // // 将修改后的 DOM 对象转换回 HTML 字符串
  // const cleanedHtmlString = doc.documentElement.outerHTML;

  // 定义正则表达式来匹配 class="reference" 的 <sup> 标签及其内容
  const pattern = /<sup[^>]*>[\s\S]*?<\/sup>/g
  // 使用 replace 方法来删除匹配的内容
  const cleanedHtmlString = htmlString.replace(pattern, "")

  // 过滤 class 是reference的 sup 标签
  return cleanedHtmlString
}

/**
 * Strip HTML tags from a given string.
 * @param {string} htmlString - The input string containing HTML tags.
 * @param {string[]} [tagNames] - Optional array of tag names to strip. If not provided, all tags will be stripped.
 * @returns {string} - The input string with HTML tags stripped.
 */
function stripHTMLTags(htmlString: string, tagNames?: string[]): string {
  if (!htmlString) {
    return ""
  }
  htmlString = filterReference(htmlString)

  let regex: RegExp
  if (tagNames && Array.isArray(tagNames)) {
    // Create a regex to match specified tags
    regex = new RegExp(
      `<\\/?(?:${tagNames.map((tag) => tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})[^>]*>`,
      "gi"
    )
  } else {
    // Regex to match all tags
    regex = /<\/?[^>]+(>|$)/g
  }
  return htmlString.replace(regex, "")
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

interface TemplateData {
  guide: string
  profile: string
  steps: Array<{
    title: string
    step_items: Array<{
      content: string
      children: string[]
      img?: string
    }>
  }>
  history: Array<{
    title: string
    url: string
  }>
}

interface RenderMessage {
  temp: string
  data: ArticleData
}

export const life = 42

// 监听消息并处理渲染
window.addEventListener('message', (event: MessageEvent<RenderMessage>) => {
  try {
    console.log('沙箱收到消息:', event.data)
    
    const { temp, data } = event.data
    if (!temp || !data) {
      console.error('模板或数据为空:', { temp, data })
      throw new Error('模板或数据为空')
    }

    console.log('开始渲染模板，数据:', {
      模板前100字符: temp.substring(0, 100),
      数据: data
    })

    // 编译模板
    const template = Handlebars.compile(temp)

    // 准备数据
    const templateData: TemplateData = {
      guide: data.title,
      profile: data.profile,
      steps: data.steps.map(step => ({
        title: step.title,
        step_items: step.step_items.map(item => ({
          content: item.content,
          children: item.children,
          img: item.image
        }))
      })),
      history: []
    }

    console.log('处理后的模板数据:', templateData)

    // 渲染模板并发送结果
    const html = template(templateData)
    
    console.log('渲染结果:', {
      html前500字符: html.substring(0, 500),
      html长度: html.length
    })

    // 验证渲染结果
    if (!html) {
      throw new Error('渲染结果为空')
    }

    // 尝试解析渲染结果以确保是有效的 HTML
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      if (doc.querySelector('parsererror')) {
        throw new Error('渲染结果不是有效的 HTML')
      }
    } catch (parseError) {
      console.error('HTML 解析失败:', parseError)
      throw new Error('渲染结果格式无效')
    }

    // 发送渲染结果
    console.log('发送渲染结果到父窗口')
    window.parent.postMessage(html, '*')
  } catch (error) {
    console.error('渲染失败:', error)
    window.parent.postMessage(`渲染失败: ${error instanceof Error ? error.message : String(error)}`, '*')
  }
})
