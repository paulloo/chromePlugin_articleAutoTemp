import { useState, useCallback } from "react"
import { useRequest } from "./useRequest"
import { articleService } from "../services/articleService"
import type { ArticleData } from "../types/article"
import { ProcessStatus } from "../types/article"
import { logger, LogCategory } from "../utils/logger"

interface UseArticleProcessorResult {
  loading: boolean
  error: string | null
  loadingState: {
    status: ProcessStatus
    progress: number
  }
  processArticle: (url: string) => Promise<void>
}

export const useArticleProcessor = (): UseArticleProcessorResult => {
  const [loadingState, setLoadingState] = useState<{ status: ProcessStatus; progress: number }>({
    status: ProcessStatus.INIT,
    progress: 0
  })

  // 爬虫请求
  const spider = useRequest<ArticleData, { url: string }>(
    articleService.spiderArticle.bind(articleService),
    {
      auto: false,
      retryCount: 3
    }
  )

  // 翻译请求
  const translate = useRequest<ArticleData, ArticleData>(
    articleService.translateArticle.bind(articleService),
    {
      auto: false,
      retryCount: 2
    }
  )

  // 渲染请求
  const render = useRequest<void, ArticleData>(
    articleService.renderArticle.bind(articleService),
    {
      auto: false,
      retryCount: 1
    }
  )

  const processArticle = useCallback(async (url: string) => {
    try {
      // 1. 爬虫处理
      setLoadingState({
        status: ProcessStatus.SCRAPING,
        progress: 20
      })
      logger.info('开始处理文章', {
        category: LogCategory.ARTICLE,
        data: { url }
      })

      const spiderData = await spider.execute({ url })
      logger.debug('爬虫数据', {
        category: LogCategory.ARTICLE,
        data: { spiderData }
      })

      if (!spiderData) {
        throw new Error('爬虫返回数据为空')
      }
      
      // 2. 翻译处理
      setLoadingState({
        status: ProcessStatus.TRANSLATING,
        progress: 60
      })
      const translatedData = await translate.execute(spiderData)
      logger.debug('翻译数据', {
        category: LogCategory.ARTICLE,
        data: { translatedData }
      })

      if (!translatedData) {
        throw new Error('翻译返回数据为空')
      }

      // 3. 渲染处理
      setLoadingState({
        status: ProcessStatus.RENDERING,
        progress: 90
      })
      await render.execute(translatedData)

      // 4. 完成
      setLoadingState({
        status: ProcessStatus.COMPLETE,
        progress: 100
      })
      logger.info('文章处理完成', {
        category: LogCategory.ARTICLE,
        data: { url, title: translatedData.title }
      })
    } catch (error) {
      setLoadingState({
        status: ProcessStatus.ERROR,
        progress: 0
      })
      logger.error('文章处理失败', {
        category: LogCategory.ARTICLE,
        data: { url, error }
      })
      throw error
    }
  }, [spider, translate, render])

  const loading = spider.loading || translate.loading || render.loading
  const error = spider.error || translate.error || render.error

  return {
    loading,
    error,
    loadingState,
    processArticle
  }
} 