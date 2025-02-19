import { sendToBackground } from "@plasmohq/messaging"
import type { ArticleData } from "../../types/article"
import type { ApiResponse, ErrorResponse } from "../../utils/errorHandler"
import { logger, LogCategory } from "../../utils/logger"
import { translateManager } from "../../utils/translate/manager"

// 发送消息到后台并等待响应
async function sendMessageToBackground(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

export const validateData = (data: any): data is ArticleData => {
  if (typeof data !== 'object' || !data) return false;
  if (typeof data.title !== 'string') return false;
  if (typeof data.profile !== 'string') return false;
  if (!Array.isArray(data.steps)) return false;
  
  return data.steps.every(step => 
    typeof step === 'object' &&
    typeof step.title === 'string' &&
    Array.isArray(step.step_items) &&
    step.step_items.every(item =>
      typeof item === 'object' &&
      typeof item.content === 'string' &&
      Array.isArray(item.children) &&
      item.children.every(child => typeof child === 'string')
    )
  );
}

export const translateArticleData = async (data: ArticleData): Promise<ArticleData> => {
  logger.info('开始翻译文章数据', {
    category: LogCategory.ARTICLE,
    data: { title: data.title }
  })
  
  if (!data) {
    logger.error('翻译数据为空', {
      category: LogCategory.ARTICLE
    })
    throw new Error('翻译数据为空')
  }

  try {
    // 收集所有需要翻译的文本
    const textsToTranslate: string[] = []
    
    // 添加标题和简介
    textsToTranslate.push(data.title, data.profile)
    
    // 添加步骤标题和内容
    data.steps.forEach(step => {
      textsToTranslate.push(step.title)
      step.step_items.forEach(item => {
        textsToTranslate.push(item.content)
        textsToTranslate.push(...item.children)
      })
    })

    // 批量翻译所有文本
    logger.debug('开始批量翻译', {
      category: LogCategory.ARTICLE,
      data: { 
        textCount: textsToTranslate.length,
        texts: textsToTranslate
      }
    })

    const translatedTexts = await translateManager.translateTexts(textsToTranslate)

    // 构建翻译后的数据
    let textIndex = 0
    const translatedData: ArticleData = {
      title: translatedTexts[textIndex++],
      profile: translatedTexts[textIndex++],
      steps: data.steps.map(step => ({
        title: translatedTexts[textIndex++],
        step_items: step.step_items.map(item => {
          const content = translatedTexts[textIndex++]
          const childrenCount = item.children.length
          const children = translatedTexts.slice(textIndex, textIndex + childrenCount)
          textIndex += childrenCount
          return { content, children }
        })
      }))
    }

    logger.info('文章翻译完成', {
      category: LogCategory.ARTICLE,
      data: { 
        originalTitle: data.title,
        translatedTitle: translatedData.title
      }
    })

    return translatedData
  } catch (error) {
    logger.error('翻译处理失败', {
      category: LogCategory.ARTICLE,
      data: { error }
    })
    throw error
  }
}

export const renderTempByData = async (data: ArticleData): Promise<void> => {
  logger.info('开始渲染文章', {
    category: LogCategory.ARTICLE,
    data: { title: data.title }
  })
  
  try {
    const response = await sendToBackground<ArticleData, ApiResponse<void>>({
      name: "renderArticle",
      body: data
    })

    if (!response.success) {
      const errorResponse = response as ErrorResponse
      logger.error('渲染失败', {
        category: LogCategory.ARTICLE,
        data: { error: errorResponse.error }
      })
      throw new Error(errorResponse.error.message || '渲染失败')
    }

    logger.info('渲染完成', {
      category: LogCategory.ARTICLE,
      data: { title: data.title }
    })
  } catch (error) {
    logger.error('渲染失败', {
      category: LogCategory.ARTICLE,
      data: { error }
    })
    throw error
  }
} 