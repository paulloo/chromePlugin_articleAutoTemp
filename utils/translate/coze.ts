import axios from "axios"
import { logger, LogCategory } from "../logger"
import type { TranslateConfig, TranslateOptions, ITranslator } from "./types"

interface WorkflowResponse {
  code: number
  data?: string
  msg: string
  debug_url?: string
  execute_id?: string
  token?: number
}

export class CozeTranslator implements ITranslator {
  private config: TranslateConfig
  private conversationId: string

  constructor(config: TranslateConfig) {
    this.config = config
    this.conversationId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async callWorkflow(text: string | string[], options?: TranslateOptions): Promise<string | string[]> {
    try {
      logger.debug('调用 Coze 工作流', {
        category: LogCategory.TRANSLATE,
        data: { text, options }
      })

      const response = await axios.post<WorkflowResponse>(
        `${this.config.apiUrl}/open_api/v2/workflow/run`,
        {
          workflow_id: this.config.apiKey,
          parameters: {
            text,
            from: options?.from || 'en',
            to: options?.to || 'zh'
          },
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options?.timeout || this.config.timeout
        }
      )

      if (response.data.code !== 0) {
        throw new Error(`工作流调用失败: ${response.data.msg}`)
      }

      if (!response.data.data) {
        throw new Error('工作流返回数据为空')
      }

      try {
        const result = JSON.parse(response.data.data)
        return result.output || (Array.isArray(text) ? [] : '')
      } catch (parseError) {
        logger.error('解析工作流响应失败', {
          category: LogCategory.TRANSLATE,
          data: { 
            error: parseError,
            response: response.data
          }
        })
        throw new Error('解析工作流响应失败')
      }
    } catch (error) {
      logger.error('工作流调用失败', {
        category: LogCategory.TRANSLATE,
        data: { error, text }
      })
      throw error
    }
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

      const result = await this.callWorkflow(text, options) as string

      logger.debug('翻译完成', {
        category: LogCategory.TRANSLATE,
        data: {
          original: text,
          translated: result
        }
      })

      return result.trim()
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

      const batchSize = this.config.maxBatchSize || 50
      const results: string[] = []

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize)
        const batchPromises = []

        // 将每个批次分成更小的并发请求（每3个一组）
        const concurrentBatchSize = 3
        for (let j = 0; j < batch.length; j += concurrentBatchSize) {
          const concurrentBatch = batch.slice(j, j + concurrentBatchSize)
          const batchPromise = Promise.all(
            concurrentBatch.map(text => this.translateText(text, options))
          )
          batchPromises.push(batchPromise)
        }

        // 等待当前批次的所有并发请求完成
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults.flat())

        // 添加延时避免请求过快
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        logger.debug('批次翻译完成', {
          category: LogCategory.TRANSLATE,
          data: { 
            currentCount: Math.min(i + batchSize, texts.length),
            totalCount: texts.length,
            batchResults: batchResults.flat()
          }
        })
      }

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