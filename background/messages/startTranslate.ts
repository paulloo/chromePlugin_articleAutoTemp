import type { PlasmoMessaging } from "@plasmohq/messaging"
import { logger, LogCategory } from "../../utils/logger"
import { translateManager } from "../../utils/translate/manager"
import type { ArticleData, ApiResponse } from "../../types/api"
import type { TranslateServiceType } from "../../utils/translate/types"

interface TranslateRequest {
  data: ArticleData
  serviceType?: TranslateServiceType
}

const handler: PlasmoMessaging.MessageHandler<TranslateRequest, ApiResponse<ArticleData>> = async (req, res) => {
  const { data, serviceType } = req.body
  const requestId = Math.random().toString(36).substring(7)

  try {
    // 如果提供了服务类型，初始化对应的服务
    if (serviceType) {
      translateManager.initService({
        type: serviceType,
        apiUrl: process.env.PLASMO_PUBLIC_TRANSLATE_GOOGLE_API_URL,
        apiKey: process.env.PLASMO_PUBLIC_TRANSLATE_GOOGLE_API_KEY
      })
    }

    logger.info('开始翻译文章', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        title: data.title,
        serviceType,
        timestamp: new Date().toISOString()
      }
    })

    const translateOptions = {
      from: 'en',
      to: 'zh'
    }

    // 翻译标题
    const translatedTitle = await translateManager.translateText(data.title, translateOptions)

    // 翻译简介
    const translatedProfile = await translateManager.translateText(data.profile, translateOptions)

    // 翻译步骤
    const translatedSteps = await Promise.all(
      data.steps.map(async (step) => {
        // 翻译步骤标题
        const translatedStepTitle = await translateManager.translateText(step.title, translateOptions)

        // 翻译步骤内容
        const translatedStepItems = await Promise.all(
          step.step_items.map(async (item) => {
            const translatedContent = await translateManager.translateText(item.content, translateOptions)

            // 翻译子项
            const translatedChildren = await Promise.all(
              item.children.map(child => 
                translateManager.translateText(child, translateOptions)
              )
            )

            return {
              ...item,
              content: translatedContent,
              children: translatedChildren
            }
          })
        )

        return {
          title: translatedStepTitle,
          step_items: translatedStepItems
        }
      })
    )

    // 构建翻译后的文章数据
    const translatedData: ArticleData = {
      ...data,
      title: translatedTitle,
      profile: translatedProfile,
      steps: translatedSteps,
      guide: data.guide || "点击上方蓝字关注我们"
    }

    logger.info('翻译成功', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        originalTitle: data.title,
        translatedTitle: translatedData.title,
        serviceType,
        hasGuide: !!translatedData.guide,
        timestamp: new Date().toISOString()
      }
    })
    
    res.send({
      success: true,
      data: translatedData
    })
  } catch (error) {
    logger.error('翻译处理失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        title: data.title,
        serviceType,
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    })

    res.send({
      success: false,
      data: null,
      error: {
        message: error instanceof Error ? error.message : '翻译处理失败',
        code: 'TRANSLATE_ERROR'
      }
    })
  }
}

export default handler
