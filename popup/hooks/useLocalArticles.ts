import { useState, useCallback, useEffect } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { logger, LogCategory } from "../../utils/logger"
import type { ArticleListItem, ArticleContent } from "../../types/article"
import type { ApiResponse, ErrorResponse } from "../../utils/errorHandler"

interface UseLocalArticlesResult {
  localArticles: ArticleListItem[]
  loading: boolean
  error: string | null
  refreshLocalArticles: () => Promise<void>
  getLocalArticle: (filename: string) => Promise<void>
  deleteLocalArticle: (filename: string) => Promise<void>
}

export const useLocalArticles = (): UseLocalArticlesResult => {
  const [state, setState] = useState<{
    localArticles: ArticleListItem[]
    loading: boolean
    error: string | null
  }>({
    localArticles: [],
    loading: false,
    error: null
  })

  const fetchArticles = useCallback(async () => {
    // 防止重复请求
    setState(prev => {
      if (prev.loading) return prev
      return { ...prev, loading: true, error: null }
    })

    try {
      logger.info('开始获取文章列表', {
        category: LogCategory.ARTICLE,
        data: { 时间戳: new Date().toISOString() }
      })

      const response = await sendToBackground<void, ApiResponse<ArticleListItem[]>>({
        name: "get-local-articles"
      })

      logger.debug('获取到响应', {
        category: LogCategory.ARTICLE,
        data: { 
          响应: response,
          时间戳: new Date().toISOString() 
        }
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        throw new Error(errorResponse.error.message || '获取文章列表失败')
      }

      const articles = Array.isArray(response.data) ? response.data : []
      
      logger.info('成功获取文章列表', {
        category: LogCategory.ARTICLE,
        data: { 
          文章数量: articles.length,
          时间戳: new Date().toISOString() 
        }
      })
      
      setState({
        localArticles: articles,
        loading: false,
        error: null
      })
    } catch (error) {
      logger.error('获取文章列表失败', {
        category: LogCategory.ARTICLE,
        data: { 
          错误类型: error instanceof Error ? error.name : typeof error,
          错误信息: error instanceof Error ? error.message : String(error),
          错误栈: error instanceof Error ? error.stack : undefined,
          时间戳: new Date().toISOString()
        }
      })

      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '获取文章列表失败'
      }))
    }
  }, [])

  const getLocalArticle = useCallback(async (filename: string) => {
    try {
      logger.info('获取单篇文章', {
        category: LogCategory.ARTICLE,
        data: { filename }
      })

      const response = await sendToBackground<{ filename: string }, ApiResponse<ArticleContent>>({
        name: "get-local-article-by-name",
        body: { filename }
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        throw new Error(errorResponse.error.message || '获取文章失败')
      }

      // 渲染文章
      await sendToBackground({
        name: "renderArticle",
        body: response.data
      })

      logger.info('文章渲染完成', {
        category: LogCategory.ARTICLE,
        data: { filename }
      })
    } catch (error) {
      logger.error('获取文章失败', {
        category: LogCategory.ARTICLE,
        data: { 
          错误类型: error instanceof Error ? error.name : typeof error,
          错误信息: error instanceof Error ? error.message : String(error),
          错误栈: error instanceof Error ? error.stack : undefined,
          filename
        }
      })
      throw error
    }
  }, [])

  const deleteLocalArticle = useCallback(async (filename: string) => {
    try {
      logger.info('删除文章', {
        category: LogCategory.ARTICLE,
        data: { filename }
      })

      const response = await sendToBackground<{ filename: string }, ApiResponse<void>>({
        name: "delete-local-article-by-name",
        body: { filename }
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        throw new Error(errorResponse.error.message || '删除文章失败')
      }

      // 刷新列表
      await fetchArticles()

      logger.info('文章删除完成', {
        category: LogCategory.ARTICLE,
        data: { filename }
      })
    } catch (error) {
      logger.error('删除文章失败', {
        category: LogCategory.ARTICLE,
        data: { 
          错误类型: error instanceof Error ? error.name : typeof error,
          错误信息: error instanceof Error ? error.message : String(error),
          错误栈: error instanceof Error ? error.stack : undefined,
          filename
        }
      })
      throw error
    }
  }, [fetchArticles])

  // 在组件挂载时自动获取文章列表
  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  return {
    ...state,
    refreshLocalArticles: fetchArticles,
    getLocalArticle,
    deleteLocalArticle
  }
}