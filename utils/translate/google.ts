import axios from "axios"
import { logger, LogCategory } from "../logger"
import type { TranslateConfig, TranslateOptions, ITranslator } from "./types"

interface GoogleTranslateResponse {
  data: {
    translations: Array<{
      translatedText: string
      detectedSourceLanguage?: string
    }>
  }
}

export class GoogleTranslator implements ITranslator {
  private config: TranslateConfig

  constructor(config: TranslateConfig) {
    this.config = config
  }

  async translateText(text: string, options?: TranslateOptions): Promise<string> {
    if (!text?.trim()) {
      logger.info('跳过空文本', {
        category: LogCategory.TRANSLATE
      })
      return ''
    }

    try {
      logger.debug('发送翻译请求', {
        category: LogCategory.TRANSLATE,
        data: { text }
      })

      const response = await axios.post<GoogleTranslateResponse>(
        `${this.config.apiUrl}?key=${this.config.apiKey}`,
        {
          q: text,
          target: options?.to || 'zh',
          source: options?.from || 'en'
        },
        {
          timeout: options?.timeout || this.config.timeout
        }
      )

      if (!response.data?.data?.translations?.[0]) {
        throw new Error('翻译结果格式无效')
      }

      const result = response.data.data.translations[0].translatedText.trim()

      logger.debug('翻译完成', {
        category: LogCategory.TRANSLATE,
        data: {
          original: text,
          translated: result
        }
      })

      return result
    } catch (error) {
      logger.error('翻译失败', {
        category: LogCategory.TRANSLATE,
        data: { error, text }
      })
      throw error
    }
  }

  async translateBatch(texts: string[], options?: TranslateOptions): Promise<string[]> {
    if (!texts?.length) return []

    try {
      logger.debug('发送批量翻译请求', {
        category: LogCategory.TRANSLATE,
        data: { count: texts.length }
      })

      // 创建并发翻译任务
      const batchPromises = texts.map((text, index) => {
        // 为每个请求添加延迟，避免并发请求过多
        const delay = Math.floor(index / 5) * 100 // 每5个请求一组，组间延迟100ms
        return new Promise<string>(async (resolve) => {
          try {
            await new Promise(r => setTimeout(r, delay))
            const result = await this.translateText(text, options)
            resolve(result)
          } catch (error) {
            logger.error('单条翻译失败', {
              category: LogCategory.TRANSLATE,
              data: { error, text, index }
            })
            resolve(text) // 翻译失败时返回原文
          }
        })
      })

      // 并发执行所有翻译任务
      const results = await Promise.all(batchPromises)

      logger.debug('批量翻译完成', {
        category: LogCategory.TRANSLATE,
        data: { 
          totalCount: texts.length,
          results
        }
      })

      return results
    } catch (error) {
      logger.error('批量翻译失败', {
        category: LogCategory.TRANSLATE,
        data: { error, count: texts.length }
      })
      throw error
    }
  }
} 