import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { logger, LogCategory } from "../../utils/logger"
import type { ArticleData, ApiResponse } from "../../types/api"

const storage = new Storage()

interface CacheArticleRequest {
  url: string
  data: ArticleData
}

const handler: PlasmoMessaging.MessageHandler<CacheArticleRequest, ApiResponse<void>> = async (req, res) => {
  const { url, data } = req.body
  const requestId = Math.random().toString(36).substring(7)

  try {
    logger.info('开始缓存文章', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        url,
        title: data.title,
        timestamp: new Date().toISOString()
      }
    })

    // 获取现有缓存
    const cachedArticles = await storage.get<Record<string, ArticleData>>('article_cache') || {}

    // 更新缓存
    cachedArticles[url] = {
      ...data,
      timestamp: new Date().toISOString()
    }

    // 保存缓存
    await storage.set('article_cache', cachedArticles)

    logger.info('文章缓存成功', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        url,
        title: data.title,
        timestamp: new Date().toISOString()
      }
    })

    res.send({
      success: true,
      data: null
    })
  } catch (error) {
    logger.error('缓存文章失败', {
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
        message: error instanceof Error ? error.message : '缓存文章失败',
        code: 'CACHE_ERROR'
      }
    })
  }
}

export default handler 