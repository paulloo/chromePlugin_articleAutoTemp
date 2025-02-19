import type { PlasmoMessaging } from "@plasmohq/messaging"
import axios from "axios"
import { createErrorResponse, createSuccessResponse, withErrorHandling } from "../../utils/errorHandler"
import type { ArticleContent, ArticleRequestParams, ArticleData } from "../../types/article"
import { logger, LogCategory } from "../../utils/logger"

// 数据清理函数
const cleanArticleData = (rawData: any): ArticleData => {
  // 清理步骤数据
  const cleanSteps = (rawSteps: any[]) => {
    return rawSteps
      .filter(step => step.title || step.items?.length)
      .map(step => ({
        title: step.title || "",
        step_items: (step.items || [])
          .filter(item => item.content || item.image)
          .map(item => ({
            content: item.content || "",
            children: []
          }))
      }))
  }

  return {
    title: rawData.title || "",
    profile: rawData.profile || "",
    steps: rawData.steps ? cleanSteps(rawData.steps) : []
  }
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const requestId = Math.random().toString(36).substring(7)
  const apiURL = process.env.PLASMO_PUBLIC_ARTICLE_API

  logger.info('收到获取文章请求', {
    category: LogCategory.ARTICLE,
    data: { 
      requestId,
      请求参数: req.body,
      时间戳: new Date().toISOString()
    }
  })

  if (!apiURL) {
    logger.error('API未配置', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        时间戳: new Date().toISOString()
      }
    })
    return res.send(createErrorResponse(
      new Error("API未配置"),
      "API未配置"
    ))
  }

  const params = req.body as ArticleRequestParams
  if (!params?.filename) {
    logger.error('文件名不能为空', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        params,
        时间戳: new Date().toISOString()
      }
    })
    return res.send(createErrorResponse(
      new Error("文件名不能为空"),
      "文件名不能为空"
    ))
  }

  try {
    logger.info('开始获取文章', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        filename: params.filename,
        时间戳: new Date().toISOString()
      }
    })

    const response = await axios.get(`${apiURL}/get_data/${params.filename}`)

    if (!response.data) {
      throw new Error('获取文章数据为空')
    }

    logger.debug('获取到原始数据', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        rawData: response.data,
        时间戳: new Date().toISOString()
      }
    })

    // 清理和格式化数据
    const cleanedData = cleanArticleData(response.data)

    logger.debug('清理后的数据', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        cleanedData,
        时间戳: new Date().toISOString()
      }
    })

    return res.send(createSuccessResponse(cleanedData))
  } catch (error) {
    logger.error('获取文章失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        filename: params.filename,
        error,
        错误类型: typeof error,
        错误信息: error.message,
        错误栈: error.stack,
        时间戳: new Date().toISOString()
      }
    })

    return res.send(createErrorResponse(error))
  }
}

export default withErrorHandling(handler)
