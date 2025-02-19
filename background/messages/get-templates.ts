import type { PlasmoMessaging } from "@plasmohq/messaging"
import axios from "axios"
import { createErrorResponse, createSuccessResponse, withErrorHandling } from "../../utils/errorHandler"
import { logger, LogCategory } from "../../utils/logger"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const requestId = Math.random().toString(36).substring(7)
  const apiURL = process.env.PLASMO_PUBLIC_ARTICLE_API

  if (!apiURL) {
    logger.error('API未配置', {
      category: LogCategory.ARTICLE,
      data: { requestId }
    })
    return res.send(createErrorResponse(
      new Error("API未配置"),
      "API未配置"
    ))
  }

  try {
    logger.info('获取模板列表', {
      category: LogCategory.ARTICLE,
      data: { requestId }
    })

    const response = await axios.get(`${apiURL}/templates`)
    
    if (!response.data) {
      throw new Error('获取模板列表失败')
    }

    logger.info('获取模板列表成功', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        templates: response.data
      }
    })

    return res.send(createSuccessResponse(response.data))
  } catch (error) {
    logger.error('获取模板列表失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        error,
        errorMessage: error.message,
        errorStack: error.stack
      }
    })
    return res.send(createErrorResponse(error))
  }
}

export default withErrorHandling(handler) 