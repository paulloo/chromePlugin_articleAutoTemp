import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { logger, LogCategory } from "../../utils/logger"
import type { ArticleData, ApiResponse } from "../../types/api"

const storage = new Storage()

interface GetCachedArticleRequest {
  url: string
}

const handler: PlasmoMessaging.MessageHandler<GetCachedArticleRequest, ApiResponse<ArticleData>> = async (req, res) => {
  const { url } = req.body
  const requestId = Math.random().toString(36).substring(7)

  try {
    logger.info('开始获取缓存文章', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        url,
        timestamp: new Date().toISOString()
      }
    })

    // 从存储中获取文章缓存
    const cachedArticles = await storage.get<Record<string, ArticleData>>('article_cache') || {}
    const cachedArticle = cachedArticles[url]

    if (cachedArticle) {
      logger.info('找到缓存的文章', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          url,
          title: cachedArticle.title,
          timestamp: new Date().toISOString()
        }
      })

      res.send({
        success: true,
        data: cachedArticle
      })
    } else {
      logger.info('未找到缓存的文章', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          url,
          timestamp: new Date().toISOString()
        }
      })

      res.send({
        success: false,
        data: null,
        error: {
          message: '未找到缓存的文章',
          code: 'CACHE_NOT_FOUND'
        }
      })
    }
  } catch (error) {
    logger.error('获取缓存文章失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        url,
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
        message: error instanceof Error ? error.message : '获取缓存文章失败',
        code: 'CACHE_ERROR'
      }
    })
  }
}

export default handler 