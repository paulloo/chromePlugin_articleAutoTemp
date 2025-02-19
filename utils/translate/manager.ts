import { TranslateAdapter } from "./adapter"
import type { TranslateConfig, TranslateOptions } from "./types"
import { TranslateServiceType } from "./types"

class TranslateManager {
  private static instance: TranslateManager
  private adapter: TranslateAdapter | null = null
  private currentConfig: TranslateConfig | null = null

  private constructor() {}

  public static getInstance(): TranslateManager {
    if (!TranslateManager.instance) {
      TranslateManager.instance = new TranslateManager()
    }
    return TranslateManager.instance
  }

  // 初始化或切换翻译服务
  public initService(config: TranslateConfig) {
    // 如果配置没有变化，直接返回
    if (
      this.currentConfig?.type === config.type &&
      this.currentConfig?.apiUrl === config.apiUrl &&
      this.currentConfig?.apiKey === config.apiKey
    ) {
      return
    }

    this.adapter = new TranslateAdapter(config)
    this.currentConfig = config
  }

  // 获取当前配置
  public getCurrentConfig(): TranslateConfig | null {
    return this.currentConfig
  }

  // 翻译单条文本
  public async translateText(text: string, options?: TranslateOptions): Promise<string> {
    if (!this.adapter) {
      throw new Error('翻译服务未初始化')
    }
    return this.adapter.translateText(text, options)
  }

  // 翻译多条文本
  public async translateTexts(texts: string[], options?: TranslateOptions): Promise<string[]> {
    if (!this.adapter) {
      throw new Error('翻译服务未初始化')
    }
    return this.adapter.translateTexts(texts, options)
  }
}

// 导出单例实例
export const translateManager = TranslateManager.getInstance()

// 初始化默认服务
translateManager.initService({
  type: TranslateServiceType.GOOGLE,
  apiUrl: process.env.PLASMO_PUBLIC_TRANSLATE_GOOGLE_API_URL,
  apiKey: process.env.PLASMO_PUBLIC_TRANSLATE_GOOGLE_API_KEY,
  maxBatchSize: 10,
  timeout: 10000
}) 