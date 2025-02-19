import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import axios from "axios"
import { createErrorResponse, createSuccessResponse } from "../../utils/errorHandler"
import type { ArticleContent } from "../../types/article"
import { logger, LogCategory } from "../../utils/logger"

const storage = new Storage()

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

  const articleContent = req.body as ArticleContent
  if (!articleContent?.title) {
    logger.error('文章内容无效', {
      category: LogCategory.ARTICLE,
      data: { requestId, content: articleContent }
    })
    return res.send(createErrorResponse(
      new Error("文章内容无效"),
      "文章内容无效"
    ))
  }

  try {
    logger.info('开始保存文章', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        title: articleContent.title
      }
    })

    const response = await axios.post(
      `${apiURL}/save_data`,
      articleContent
    )

    if (!response.data?.success) {
      throw new Error(response.data?.message || '保存失败')
    }

    logger.info('保存文章成功', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        title: articleContent.title,
        response: response.data
      }
    })

    return res.send(createSuccessResponse(void 0))
  } catch (error) {
    logger.error('保存文章失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        title: articleContent.title,
        error,
        errorMessage: error.message,
        errorStack: error.stack
      }
    })
    return res.send(createErrorResponse(error))
  }
}

export default handler