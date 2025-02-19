import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { ArticleData } from "../../types/article"
import { logger, LogCategory } from "../../utils/logger"
import { createErrorResponse, createSuccessResponse } from "../../utils/errorHandler"
import { translateManager } from "../../utils/translate/manager"
import { TranslateServiceType } from "../../utils/translate/types"

// 添加文本清理函数
function cleanText(text: string): string {
  if (!text) return '';
  
  // 过滤引用标记
  text = text.replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '');
  // 过滤HTML标签
  text = text.replace(/<\/?[^>]+(>|$)/g, "");
  // 清理空白字符
  text = text.trim();
  // 移除多余空格
  text = text.replace(/\s+/g, ' ');
  
  return text;
}

// 添加文章数据翻译函数
async function translateArticleData(data: ArticleData, serviceType: TranslateServiceType = TranslateServiceType.GOOGLE): Promise<ArticleData> {
  logger.info('开始翻译文章数据', {
    category: LogCategory.ARTICLE,
    data: { 
      title: data.title,
      serviceType
    }
  })
  
  try {
    // 初始化翻译服务
    translateManager.initService({
      type: serviceType,
      apiUrl: process.env.PLASMO_PUBLIC_TRANSLATE_GOOGLE_API_URL!,
      apiKey: process.env.PLASMO_PUBLIC_TRANSLATE_GOOGLE_API_KEY!,
      maxBatchSize: 10,
      timeout: 10000
    })

    // 收集所有需要翻译的文本
    const textsToTranslate: string[] = []
    
    // 添加标题和简介
    textsToTranslate.push(cleanText(data.title))
    textsToTranslate.push(cleanText(data.profile))
    
    // 添加步骤标题和内容
    data.steps.forEach(step => {
      textsToTranslate.push(cleanText(step.title))
      step.step_items.forEach(item => {
        textsToTranslate.push(cleanText(item.content))
        item.children.forEach(child => {
          textsToTranslate.push(cleanText(child))
        })
      })
    })

    // 批量翻译所有文本
    logger.debug('开始批量翻译', {
      category: LogCategory.ARTICLE,
      data: { 
        textCount: textsToTranslate.length,
        texts: textsToTranslate,
        serviceType
      }
    })

    const translatedTexts = await translateManager.translateTexts(textsToTranslate, {
      from: 'en',
      to: 'zh'
    })

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
          return { 
            content, 
            children,
            image: item.image // 保留原始图片链接
          }
        })
      }))
    }

    logger.info('文章翻译完成', {
      category: LogCategory.ARTICLE,
      data: { 
        originalTitle: data.title,
        translatedTitle: translatedData.title,
        serviceType
      }
    })

    return translatedData
  } catch (error) {
    logger.error('文章翻译失败', {
      category: LogCategory.ARTICLE,
      data: { 
        error,
        serviceType
      }
    })
    throw error
  }
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const { data, serviceType = TranslateServiceType.GOOGLE } = req.body
    
    if (!data) {
      return res.send(createErrorResponse(new Error('翻译数据为空')))
    }

    const translatedData = await translateArticleData(data, serviceType)
    return res.send(createSuccessResponse(translatedData))
  } catch (error) {
    return res.send(createErrorResponse(error))
  }
}

export default handler
