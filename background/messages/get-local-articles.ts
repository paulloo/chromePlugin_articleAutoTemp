import type { PlasmoMessaging } from "@plasmohq/messaging"
import axios from "axios"
import { createErrorResponse, createSuccessResponse } from "../../utils/errorHandler"
import type { ArticleListItem } from "../../types/article"
import { logger, LogCategory } from "../../utils/logger"

// 获取文章列表的核心逻辑
const fetchArticles = async (requestId: string, apiURL: string) => {
  try {
    logger.info('开始获取文章列表', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        apiURL,
        时间戳: new Date().toISOString()
      }
    })

    const response = await axios.get(`${apiURL}/get_data_list`)
    
    logger.debug('获取到原始响应', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        status: response.status,
        headers: response.headers,
        data: response.data,
        时间戳: new Date().toISOString()
      }
    })

    if (!response.data) {
      throw new Error("响应数据为空")
    }

    // 确保返回的是数组并且有效
    const articles = Array.isArray(response.data) ? response.data : []
    
    if (articles.length === 0) {
      logger.warn('API返回的文章列表为空', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          时间戳: new Date().toISOString()
        }
      })
    } else {
      logger.info('成功获取文章列表', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          文章数量: articles.length,
          时间戳: new Date().toISOString()
        }
      })
    }

    return articles
  } catch (error) {
    logger.error('获取文章列表失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        错误类型: error instanceof Error ? error.name : typeof error,
        错误信息: error instanceof Error ? error.message : String(error),
        错误栈: error instanceof Error ? error.stack : undefined,
        时间戳: new Date().toISOString()
      }
    })
    throw error
  }
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const requestId = Math.random().toString(36).substring(7)
  const apiURL = process.env.PLASMO_PUBLIC_ARTICLE_API

  logger.info('收到获取文章列表请求', {
    category: LogCategory.ARTICLE,
    data: { 
      requestId,
      时间戳: new Date().toISOString()
    }
  })

  if (!apiURL) {
    const errorResponse = createErrorResponse(
      new Error("API未配置"),
      "API未配置"
    )

    logger.error('API未配置', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        错误响应: errorResponse,
        时间戳: new Date().toISOString()
      }
    })

    res.send(errorResponse)
  }

  try {
    const articles = await fetchArticles(requestId, apiURL)
    
    const result = createSuccessResponse(articles)

    logger.info('获取文章列表成功', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        文章数量: articles.length,
        完整响应: result,
        时间戳: new Date().toISOString()
      }
    })

    res.send(result)
  } catch (error) {
    const errorResponse = createErrorResponse(
      error,
      '获取文章列表失败'
    )

    logger.error('获取文章列表失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        错误类型: error instanceof Error ? error.name : typeof error,
        错误信息: error instanceof Error ? error.message : String(error),
        错误栈: error instanceof Error ? error.stack : undefined,
        错误响应: errorResponse,
        时间戳: new Date().toISOString()
      }
    })

    res.send(errorResponse)
  }
}

export default handler
