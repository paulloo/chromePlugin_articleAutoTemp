import { useState, useCallback } from "react"
import { useRequest } from "./useRequest"
import { articleService } from "../services/articleService"
import type { ArticleData } from "../types/article"
import { ProcessStatus } from "../types/article"
import { logger, LogCategory } from "../utils/logger"
import { translateManager } from "../utils/translate/manager"
import { TranslateServiceType } from "../utils/translate/types"
import { useTranslateService } from "../hooks/useTranslateService"
import { sendToBackground } from "@plasmohq/messaging"
import type { ApiResponse } from "../types/api"

// 文章类型检测函数
const detectArticleType = (url: string): string => {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname.includes('mp.weixin.qq.com')) {
      return 'wechat'
    }
    if (urlObj.hostname.includes('wikihow')) {
      return 'wikihow'
    }
    throw new Error('不支持的文章类型')
  } catch (error) {
    logger.error('URL解析失败', {
      category: LogCategory.ARTICLE,
      data: { url, error }
    })
    throw new Error('无效的URL格式')
  }
}

interface UseArticleProcessorResult {
  loading: boolean
  error: string | null
  loadingState: {
    status: ProcessStatus
    progress: number
  }
  processArticle: (url: string, templateId: string) => Promise<void>
  translateService: TranslateServiceType
  changeTranslateService: (type: TranslateServiceType) => void
}

export const useArticleProcessor = (): UseArticleProcessorResult => {
  const [loadingState, setLoadingState] = useState<{ status: ProcessStatus; progress: number }>({
    status: ProcessStatus.INIT,
    progress: 0
  })

  const { serviceType, changeService } = useTranslateService()

  // 爬虫请求
  const spider = useRequest<ArticleData, { url: string; templateId: string }>(
    articleService.spiderArticle.bind(articleService),
    {
      auto: false,
      retryCount: 3
    }
  )

  // 翻译请求
  const translate = useRequest<ArticleData, { data: ArticleData; serviceType: TranslateServiceType }>(
    async ({ data, serviceType }) => {
      return articleService.translateArticle(data, serviceType)
    },
    {
      auto: false,
      retryCount: 2
    }
  )

  // 渲染请求
  const render = useRequest<void, { data: ArticleData; templateId: string; tabId: number }>(
    async ({ data, templateId, tabId }) => {
      return articleService.renderArticle(data, templateId, tabId)
    },
    {
      auto: false,
      retryCount: 1
    }
  )

  const processArticle = useCallback(async (url: string, templateId: string) => {
    try {
      // 1. 爬虫处理
      setLoadingState({
        status: ProcessStatus.SCRAPING,
        progress: 20
      })
      logger.info('开始处理文章', {
        category: LogCategory.ARTICLE,
        data: { 
          url,
          templateId,
          timestamp: new Date().toISOString()
        }
      })

      const spiderData = await spider.execute({ url, templateId })
      if (!spiderData) {
        throw new Error('爬虫返回数据为空')
      }
      
      // 2. 翻译处理
      setLoadingState({
        status: ProcessStatus.TRANSLATING,
        progress: 60
      })
      const translatedData = await translate.execute({
        data: spiderData,
        serviceType: TranslateServiceType.GOOGLE
      })

      if (!translatedData) {
        throw new Error('翻译返回数据为空')
      }

      // 3. 缓存处理
      setLoadingState({
        status: ProcessStatus.CACHING,
        progress: 80
      })
      try {
        await sendToBackground<{ url: string; data: ArticleData }, ApiResponse<void>>({
          name: "cacheArticle",
          body: { url, data: translatedData }
        })
        logger.info('文章缓存成功', {
          category: LogCategory.ARTICLE,
          data: { 
            url,
            title: translatedData.title,
            timestamp: new Date().toISOString()
          }
        })
      } catch (error) {
        logger.warn('文章缓存失败，继续处理', {
          category: LogCategory.ARTICLE,
          data: { 
            url,
            error,
            timestamp: new Date().toISOString()
          }
        })
      }

      // 4. 渲染处理
      setLoadingState({
        status: ProcessStatus.RENDERING,
        progress: 90
      })

      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const currentTab = tabs[0]

      if (!currentTab?.id || !currentTab.url?.includes('mp.weixin.qq.com')) {
        logger.warn('未找到有效的微信编辑器标签页', {
          category: LogCategory.ARTICLE,
          data: { 
            url,
            tabInfo: currentTab,
            timestamp: new Date().toISOString()
          }
        })
        throw new Error('请在微信公众号编辑器中使用此功能')
      }

      await render.execute({
        data: translatedData,
        templateId,
        tabId: currentTab.id
      })

      // 5. 完成
      setLoadingState({
        status: ProcessStatus.COMPLETE,
        progress: 100
      })
      logger.info('文章处理完成', {
        category: LogCategory.ARTICLE,
        data: { 
          url, 
          title: translatedData.title,
          templateId,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      setLoadingState({
        status: ProcessStatus.ERROR,
        progress: 0
      })
      logger.error('文章处理失败', {
        category: LogCategory.ARTICLE,
        data: { 
          url,
          templateId,
          error,
          timestamp: new Date().toISOString()
        }
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
    processArticle,
    translateService: serviceType,
    changeTranslateService: changeService
  }
}
