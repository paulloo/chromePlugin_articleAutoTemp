import type { PlasmoMessaging } from "@plasmohq/messaging"
import { logger, LogCategory } from "../../utils/logger"
import { apiClient } from "../../utils/api"
import { ApiEndpoints } from "../../types/api"
import type { ArticleData, ApiResponse, SpiderArticleRequest, SpiderArticleResponse } from "../../types/api"

interface SpiderRequest {
  url: string
  templateId: string
}

const handler: PlasmoMessaging.MessageHandler<SpiderRequest, ApiResponse<ArticleData>> = async (req, res) => {
  const { url, templateId } = req.body
  const requestId = Math.random().toString(36).substring(7)

  try {
    logger.info('开始爬取文章', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        url,
        templateId,
        timestamp: new Date().toISOString()
      }
    })

    // 1. 调用爬虫接口
    const spiderResponse = await apiClient.post<SpiderArticleResponse>(
      ApiEndpoints.SPIDER_ARTICLE,
      { 
        url,
        template_id: templateId
      }
    )

    if (spiderResponse.status !== 'success' || !spiderResponse.data?.article_id) {
      logger.error('爬虫返回数据无效', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          response: spiderResponse
        }
      })
      return res.send({
        success: false,
        data: null,
        error: {
          message: '爬虫返回数据无效',
          code: 'INVALID_RESPONSE'
        }
      })
    }
    console.log("spiderResponse.data: ", spiderResponse.data)
    const articleId = spiderResponse.data.article_id

    logger.info('爬虫请求成功', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        articleId,
        message: spiderResponse.data,
        timestamp: new Date().toISOString()
      }
    })

    // 2. 获取文章详情
    const articleResponse = await apiClient.get<ArticleData>(
      `${ApiEndpoints.GET_ARTICLE}/${articleId}`
    )

    if (articleResponse.status !== 'success' || !articleResponse.data) {
      logger.error('获取文章详情失败', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          articleId,
          response: articleResponse
        }
      })
      return res.send({
        success: false,
        data: null,
        error: {
          message: '获取文章详情失败',
          code: 'FETCH_ERROR'
        }
      })
    }

    const articleData = articleResponse.data

    logger.info('获取文章详情成功', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        articleId,
        title: articleData.title,
        timestamp: new Date().toISOString()
      }
    })

    // 返回完整的文章数据
    res.send({
      success: true,
      data: {
        ...articleData,
        guide: "点击上方蓝字关注我们"
      }
    })
  } catch (error) {
    logger.error('爬取文章失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        url,
        templateId,
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
        message: error instanceof Error ? error.message : '爬取文章失败',
        code: 'SPIDER_ERROR'
      }
    })
  }
}

export default handler
