import type { PlasmoMessaging } from "@plasmohq/messaging"
import { logger, LogCategory } from "../../utils/logger"
import { apiClient } from "../../utils/api"
import { ApiEndpoints } from "../../types/api"
import type { LocalArticle, ApiResponse } from "../../types/api"

const handler: PlasmoMessaging.MessageHandler<void, ApiResponse<LocalArticle>> = async (req, res) => {
  const requestId = Math.random().toString(36).substring(7)

  try {
    logger.info('开始获取本地文章列表', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        timestamp: new Date().toISOString()
      }
    })

    logger.debug('准备发送API请求', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        endpoint: ApiEndpoints.GET_ARTICLES,
        timestamp: new Date().toISOString()
      }
    })

    const response = await apiClient.request<LocalArticle>({
      method: 'GET',
      url: ApiEndpoints.GET_ARTICLES
    })
    
    console.log("response: ", response)
    logger.debug('收到API响应', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        responseStatus: response.status,
        responseDataExists: !!response.data,
        itemsCount: response.data?.items?.length,
        timestamp: new Date().toISOString()
      }
    })

    if (!response.data?.items) {
      throw new Error('API响应数据格式不正确')
    }

    if (response.data.items.length === 0) {
      logger.warn('API返回的文章列表为空', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          timestamp: new Date().toISOString()
        }
      })
    }

    logger.info('获取本地文章列表成功', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        articlesCount: response.data.items.length,
        articles: response.data.items.map(a => a.title),
        timestamp: new Date().toISOString()
      }
    })

    res.send(response)
  } catch (error) {
    logger.error('获取本地文章列表失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        error,
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    })

    if ((error as any).status === 'error') {
      res.send(error)
      return
    }

    res.send({
      status: 'error',
      message: error instanceof Error ? error.message : '获取本地文章列表失败',
      data: {
        items: [],
        pagination: null
      },
      timestamp: new Date().toISOString()
    })
  }
}

export default handler
