// 翻译服务类型
export enum TranslateServiceType {
  GOOGLE = 'google',
  COZE = 'coze',
  CUSTOM = 'custom'
}

// 翻译配置接口
export interface TranslateConfig {
  type: TranslateServiceType
  apiUrl: string
  apiKey?: string
  maxBatchSize?: number
  timeout?: number
}

// 翻译选项
export interface TranslateOptions {
  from?: string
  to?: string
  timeout?: number
}

// 翻译结果接口
export interface TranslateResult {
  text: string
  from?: string
  to?: string
}

// 批量翻译结果
export interface BatchTranslateResult {
  texts: string[]
  from?: string
  to?: string
}

// 翻译器接口
export interface ITranslator {
  translateText(text: string, options?: TranslateOptions): Promise<string>
  translateBatch(texts: string[], options?: TranslateOptions): Promise<string[]>
} 