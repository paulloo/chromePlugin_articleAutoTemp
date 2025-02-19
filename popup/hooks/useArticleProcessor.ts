import { useState, useCallback } from "react"
import { useRequest } from "../../hooks/useRequest"
import { articleService } from "../../services/articleService"
import type { ArticleData } from "../../types/article"
import { ProcessStatus } from "../../types/article"
import { logger, LogCategory } from "../../utils/logger"
import { translateManager } from "../../utils/translate/manager"
import { TranslateServiceType } from "../../utils/translate/types"
import { useTranslateService } from "../../hooks/useTranslateService"

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
  processArticle: (url: string, templateName: string, tabId: number) => Promise<void>
  translateService: TranslateServiceType
  changeTranslateService: (type: TranslateServiceType) => void
}

export const useArticleProcessor = (): UseArticleProcessorResult => {
  const [loadingState, setLoadingState] = useState<{ status: ProcessStatus; progress: number }>({
    status: ProcessStatus.INIT,
    progress: 0
  })

  // 翻译服务
  const { 
    serviceType: translateService, 
    changeService: changeTranslateService,
    translateTexts
  } = useTranslateService()

  // 爬虫请求
  const spider = useRequest<ArticleData, { url: string; type: string }>(
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
  const render = useRequest<void, { data: ArticleData; templateName: string; tabId: number }>(
    async ({ data, templateName, tabId }) => {
      return articleService.renderArticle(data, templateName, tabId)
    },
    {
      auto: false,
      retryCount: 1
    }
  )

  // 翻译文章数据
  const translateArticleData = useCallback(async (data: ArticleData): Promise<ArticleData> => {
    logger.info('开始翻译文章数据', {
      category: LogCategory.ARTICLE,
      data: { 
        title: data.title,
        translateService 
      }
    })

    try {
      // 收集所有需要翻译的文本
      const textsToTranslate: string[] = []
      
      // 添加标题和简介
      textsToTranslate.push(data.title, data.profile)
      
      // 添加步骤标题和内容
      data.steps.forEach(step => {
        textsToTranslate.push(step.title)
        step.step_items.forEach(item => {
          textsToTranslate.push(item.content)
          textsToTranslate.push(...item.children)
        })
      })

      // 批量翻译所有文本
      logger.debug('开始批量翻译', {
        category: LogCategory.ARTICLE,
        data: { 
          textCount: textsToTranslate.length,
          texts: textsToTranslate,
          service: translateService
        }
      })

      const translatedTexts = await translateTexts(textsToTranslate, {
        from: 'en',
        to: 'zh'
      })

      // 构建翻译后的数据
      let textIndex = 0
      const translatedData: ArticleData = {
        title: translatedTexts[textIndex++],
        profile: translatedTexts[textIndex++],
        steps: data.steps.map(step => ({
          title: translatedTexts[textIndex++],
          step_items: step.step_items.map(item => {
            const content = translatedTexts[textIndex++]
            const childrenCount = item.children.length
            const children = translatedTexts.slice(textIndex, textIndex + childrenCount)
            textIndex += childrenCount
            return { 
              content, 
              children,
              image: item.image // 保留原始图片链接
            }
          })
        }))
      }

      logger.info('文章翻译完成', {
        category: LogCategory.ARTICLE,
        data: { 
          originalTitle: data.title,
          translatedTitle: translatedData.title,
          service: translateService
        }
      })

      return translatedData
    } catch (error) {
      logger.error('翻译处理失败', {
        category: LogCategory.ARTICLE,
        data: { 
          error,
          service: translateService
        }
      })
      throw error
    }
  }, [translateService, translateTexts])

  const processArticle = useCallback(async (url: string, templateName: string, tabId: number) => {
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

      const articleType = detectArticleType(url)
      const articleData = await spider.execute({ url, type: articleType })
      
      logger.debug('爬虫数据', {
        category: LogCategory.ARTICLE,
        data: { articleData }
      })

      if (!articleData) {
        throw new Error('爬虫返回数据为空')
      }
      
      // 2. 翻译处理
      setLoadingState({
        status: ProcessStatus.TRANSLATING,
        progress: 60
      })

      logger.info('开始翻译文章数据', {
        category: LogCategory.ARTICLE,
        data: { 
          title: articleData.title,
          translateService
        }
      })

      const translatedData = await translate.execute({ 
        data: articleData,
        serviceType: translateService
      })
      
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

      await render.execute({
        data: translatedData,
        templateName,
        tabId
      })

      // 4. 完成
      setLoadingState({
        status: ProcessStatus.COMPLETE,
        progress: 100
      })
      
      logger.info('文章处理完成', {
        category: LogCategory.ARTICLE,
        data: { 
          url, 
          title: articleData.title,
          tabId
        }
      })
    } catch (error) {
      setLoadingState({
        status: ProcessStatus.ERROR,
        progress: 0
      })
      
      logger.error('文章处理失败', {
        category: LogCategory.ARTICLE,
        data: { url, error, tabId }
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
    translateService,
    changeTranslateService
  }
}
