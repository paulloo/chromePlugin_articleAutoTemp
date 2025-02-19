import { sendToBackground } from "@plasmohq/messaging"
import type { ApiResponse, ErrorResponse } from "../utils/errorHandler"
import type { ArticleListItem, ArticleContent, ArticleRequestParams } from "../types/article"
import { useRequest } from "./useRequest"
import type { RequestOptions } from "./useRequest"
import { logger, LogCategory } from "../utils/logger"
import { articleService } from "../services/articleService"

// 文章相关的请求函数
const articleRequests = {
  // 获取文章列表
  getArticleList: async () => {
    logger.info('获取文章列表', { category: LogCategory.ARTICLE })

    try {
      // 尝试使用 Plasmo 消息机制
      const response = await sendToBackground<void, ApiResponse<ArticleListItem[]>>({
        name: "get-local-articles"
      })

      logger.debug('收到文章列表响应', {
        category: LogCategory.ARTICLE,
        data: { 
          response,
          responseJSON: JSON.stringify(response, null, 2)
        }
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        logger.error('获取文章列表失败', {
          category: LogCategory.ARTICLE,
          data: { error: errorResponse.error }
        })
        throw new Error(errorResponse.error.message || '获取文章列表失败')
      }

      // 确保响应数据是数组
      const articles = Array.isArray(response.data) ? response.data : []

      logger.info('获取文章列表成功', {
        category: LogCategory.ARTICLE,
        data: { 
          文章数量: articles.length,
          文章列表: articles 
        }
      })

      // 如果列表为空，记录警告
      if (articles.length === 0) {
        logger.warn('获取到的文章列表为空', {
          category: LogCategory.ARTICLE,
          data: { response }
        })
      }

      return articles
    } catch (error) {
      logger.warn('Plasmo 消息发送失败，尝试使用 Chrome 消息机制', {
        category: LogCategory.ARTICLE,
        data: { error }
      })

      // 降级使用 Chrome 消息机制
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_ARTICLES' }, (response: ApiResponse<ArticleListItem[]>) => {
          if (chrome.runtime.lastError) {
            logger.error('Chrome 消息发送失败', {
              category: LogCategory.ARTICLE,
              data: { error: chrome.runtime.lastError }
            })
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          logger.debug('Chrome 消息响应', {
            category: LogCategory.ARTICLE,
            data: { 
              response,
              responseJSON: JSON.stringify(response, null, 2)
            }
          })

          if (!response.success) {
            const errorResponse = response as ErrorResponse
            logger.error('获取文章列表失败', {
              category: LogCategory.ARTICLE,
              data: { error: errorResponse.error }
            })
            reject(new Error(errorResponse.error.message || '获取文章列表失败'))
            return
          }

          const articles = Array.isArray(response.data) ? response.data : []

          logger.info('通过 Chrome 消息获取文章列表成功', {
            category: LogCategory.ARTICLE,
            data: { 
              文章数量: articles.length,
              文章列表: articles 
            }
          })

          resolve(articles)
        })
      })
    }
  },

  // 获取单篇文章
  getArticle: async (params: ArticleRequestParams) => {
    logger.info('获取文章', {
      category: LogCategory.ARTICLE,
      data: { params }
    })

    const response = await sendToBackground<ArticleRequestParams, ApiResponse<ArticleContent>>({
      name: "get-local-article-by-name",
      body: params
    })

    if (!response.success) {
      const errorResponse = response as ErrorResponse
      logger.error('获取文章失败', {
        category: LogCategory.ARTICLE,
        data: { params, error: errorResponse.error }
      })
      throw new Error(errorResponse.error.message)
    }

    logger.info('获取文章成功', {
      category: LogCategory.ARTICLE,
      data: { filename: params.filename }
    })

    return response.data
  },

  // 删除文章
  deleteArticle: async (params: ArticleRequestParams) => {
    logger.info('删除文章', {
      category: LogCategory.ARTICLE,
      data: { params }
    })

    const response = await sendToBackground<ArticleRequestParams, ApiResponse<void>>({
      name: "delete-local-article-by-name",
      body: params
    })

    if (!response.success) {
      const errorResponse = response as ErrorResponse
      logger.error('删除文章失败', {
        category: LogCategory.ARTICLE,
        data: { params, error: errorResponse.error }
      })
      throw new Error(errorResponse.error.message)
    }

    logger.info('删除文章成功', {
      category: LogCategory.ARTICLE,
      data: { filename: params.filename }
    })
  }
}

// 文章列表 Hook
export function useArticleList(options: RequestOptions = {}) {
  return useRequest<ArticleListItem[], void>(
    articleService.getArticleList.bind(articleService),
    {
      cacheTime: 5 * 60 * 1000, // 5分钟缓存
      retryCount: 2,
      requestId: 'article-list',
      ...options
    }
  )
}

// 单篇文章 Hook
export function useArticle(options: RequestOptions = {}) {
  return useRequest<ArticleContent, ArticleRequestParams>(
    articleService.getArticle.bind(articleService),
    {
      cacheTime: 10 * 60 * 1000, // 10分钟缓存
      retryCount: 2,
      requestId: 'article-detail',
      ...options
    }
  )
}

// 删除文章 Hook
export function useDeleteArticle(options: RequestOptions = {}) {
  return useRequest<void, ArticleRequestParams>(
    articleService.deleteArticle.bind(articleService),
    {
      retryCount: 1,
      requestId: 'article-delete',
      ...options
    }
  )
}

// 保存文章 Hook
export function useSaveArticle(options: RequestOptions = {}) {
  return useRequest<void, ArticleContent>(
    articleService.saveArticle.bind(articleService),
    {
      retryCount: 2,
      requestId: 'article-save',
      ...options
    }
  )
}

// 组合 Hook - 用于文章管理
export function useArticleManager() {
  const articleList = useArticleList()
  const article = useArticle({ auto: false })
  const deleteArticle = useDeleteArticle({ auto: false })
  const saveArticle = useSaveArticle({ auto: false })

  return {
    // 文章列表相关
    articles: articleList.data || [],
    listLoading: articleList.loading,
    listError: articleList.error,
    refreshList: articleList.execute,

    // 单篇文章相关
    currentArticle: article.data,
    articleLoading: article.loading,
    articleError: article.error,
    fetchArticle: (filename: string) => article.execute({ filename }),

    // 删除文章相关
    deleteLoading: deleteArticle.loading,
    deleteError: deleteArticle.error,
    deleteArticleAndRefresh: async (filename: string) => {
      await deleteArticle.execute({ filename })
      await articleList.execute()
    },

    // 保存文章相关
    saveLoading: saveArticle.loading,
    saveError: saveArticle.error,
    saveArticleAndRefresh: async (content: ArticleContent) => {
      await saveArticle.execute(content)
      await articleList.execute()
    }
  }
} 