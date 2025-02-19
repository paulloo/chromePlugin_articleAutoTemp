import { useState, useCallback, useEffect } from "react"
import { translateManager } from "../utils/translate/manager"
import { TranslateServiceType } from "../utils/translate/types"
import type { TranslateOptions } from "../utils/translate/types"
import { logger, LogCategory } from "../utils/logger"

export const useTranslateService = () => {
  const [serviceType, setServiceType] = useState<TranslateServiceType>(
    TranslateServiceType.GOOGLE
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 初始化翻译服务
  useEffect(() => {
    try {
      const config = {
        type: serviceType,
        apiUrl: process.env.PLASMO_PUBLIC_TRANSLATE_GOOGLE_API_URL,
        apiKey: process.env.PLASMO_PUBLIC_TRANSLATE_GOOGLE_API_KEY,
        maxBatchSize: 10,
        timeout: 10000
      }

      translateManager.initService(config)
    } catch (error) {
      logger.error('初始化翻译服务失败', {
        category: LogCategory.TRANSLATE,
        data: { error, serviceType }
      })
      setError(error instanceof Error ? error.message : '初始化翻译服务失败')
    }
  }, [serviceType])

  // 切换翻译服务
  const changeService = useCallback((type: TranslateServiceType) => {
    setServiceType(type)
    setError(null)
  }, [])

  // 翻译文本
  const translateText = useCallback(async (
    text: string,
    options?: TranslateOptions
  ) => {
    if (!text?.trim()) return ''

    setLoading(true)
    setError(null)

    try {
      const result = await translateManager.translateText(text, options)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '翻译失败'
      setError(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // 批量翻译
  const translateTexts = useCallback(async (
    texts: string[],
    options?: TranslateOptions
  ) => {
    if (!texts?.length) return []

    setLoading(true)
    setError(null)

    try {
      const results = await translateManager.translateTexts(texts, options)
      return results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '批量翻译失败'
      setError(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    serviceType,
    loading,
    error,
    changeService,
    translateText,
    translateTexts
  }
} 