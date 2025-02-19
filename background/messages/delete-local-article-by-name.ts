import type { PlasmoMessaging } from "@plasmohq/messaging"
import axios from "axios"
import { createErrorResponse, createSuccessResponse, withErrorHandling } from "../../utils/errorHandler"
import type { ArticleRequestParams } from "../../types/article"
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

  const params = req.body as ArticleRequestParams
  if (!params?.filename) {
    logger.error('文件名不能为空', {
      category: LogCategory.ARTICLE,
      data: { requestId, params }
    })
    return res.send(createErrorResponse(
      new Error("文件名不能为空"),
      "文件名不能为空"
    ))
  }

  try {
    logger.info('开始删除文章', {
      category: LogCategory.ARTICLE,
      data: { requestId, filename: params.filename }
    })

    await axios.delete(`${apiURL}/delete-local-article-by-name`, {
      params: { filename: params.filename }
    })

    logger.info('删除文章成功', {
      category: LogCategory.ARTICLE,
      data: { requestId, filename: params.filename }
    })

    return res.send(createSuccessResponse(void 0))
  } catch (error) {
    logger.error('删除文章失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        filename: params.filename,
        error,
        errorMessage: error.message,
        errorStack: error.stack
      }
    })
    throw error
  }
}

export default withErrorHandling(handler)
