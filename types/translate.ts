export type TranslateServiceType = 'google' | 'baidu' | 'youdao'

export interface TranslateOptions {
  service: TranslateServiceType
  sourceText: string
  sourceLang?: string
  targetLang?: string
}

export interface TranslateResult {
  translatedText: string
  sourceLang: string
  targetLang: string
  service: TranslateServiceType
} 