import { logger, LogCategory } from "../logger"
import type { 
  TranslateConfig, 
  TranslateOptions, 
  ITranslator 
} from "./types"
import { TranslateServiceType } from "./types"
import { GoogleTranslator } from "./google"
import { CozeTranslator } from "./coze"

// 默认配置
const DEFAULT_CONFIG: Partial<TranslateConfig> = {
  maxBatchSize: 10,
  timeout: 10000
}

export class TranslateAdapter {
  private translator: ITranslator
  private config: TranslateConfig

  constructor(config: TranslateConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.translator = this.createTranslator()
  }

  private createTranslator(): ITranslator {
    switch (this.config.type) {
      case TranslateServiceType.GOOGLE:
        return new GoogleTranslator(this.config)
      case TranslateServiceType.COZE:
        return new CozeTranslator(this.config)
      default:
        throw new Error(`不支持的翻译服务类型: ${this.config.type}`)
    }
  }

  // 分批处理文本
  private async processBatch(
    texts: string[], 
    options?: TranslateOptions
  ): Promise<string[]> {
    const batchSize = this.config.maxBatchSize || 10
    const results: string[] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      try {
        const batchResults = await this.translator.translateBatch(batch, options)
        results.push(...batchResults)

        // 添加延迟避免请求过快
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        logger.error('批量翻译失败，尝试单条翻译', {
          category: LogCategory.TRANSLATE,
          data: { error, batchIndex: i }
        })

        // 如果批量翻译失败，尝试逐条翻译
        for (const text of batch) {
          try {
            const result = await this.translator.translateText(text, options)
            results.push(result)
          } catch (singleError) {
            logger.error('单条翻译失败', {
              category: LogCategory.TRANSLATE,
              data: { error: singleError, text }
            })
            results.push(text) // 翻译失败时保留原文
          }
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }

    return results
  }

  // 翻译单条文本
  async translateText(text: string, options?: TranslateOptions): Promise<string> {
    if (!text?.trim()) {
      return ''
    }

    try {
      return await this.translator.translateText(text, options)
    } catch (error) {
      logger.error('翻译失败', {
        category: LogCategory.TRANSLATE,
        data: { error, text }
      })
      throw error
    }
  }

  // 翻译多条文本
  async translateTexts(texts: string[], options?: TranslateOptions): Promise<string[]> {
    if (!texts?.length) {
      return []
    }

    try {
      return await this.processBatch(texts, options)
    } catch (error) {
      logger.error('批量翻译失败', {
        category: LogCategory.TRANSLATE,
        data: { error, count: texts.length }
      })
      throw error
    }
  }
} 