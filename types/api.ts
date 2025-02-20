export interface ApiPagination {
  total: number
  page: number
  pageSize: number
}

export interface ApiListResponse<T> {
  items: T[]
  pagination: ApiPagination
}

export interface ApiError {
  message: string
  code: string
}

export interface SuccessResponse<T> {
  success: true
  data: T
  error?: never
}

export interface ErrorResponse {
  success: false
  data: null
  error: ApiError
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

export interface TemplateHtml {
  html: string
  id: string
  name: string
  updatedAt: string
}

export interface TemplateResponse {
  html: string
  name: string
  id: string
  updatedAt: string
  version: string
  metadata?: {
    author?: string
    description?: string
    tags?: string[]
  }
}

export interface PrecompiledTemplate {
  id: string
  name: string
  content: string
  precompiled: string
  updatedAt: string
}

// 文章相关接口
export interface ArticleStepItem {
  content: string
  children: string[]
  image?: string
}

export interface ArticleStep {
  title: string
  step_items: ArticleStepItem[]
}

export interface ArticleData {
  title: string
  profile: string
  steps: ArticleStep[]
  guide?: string
  timestamp?: string
}

// 本地文章相关接口
export interface LocalArticle {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  filename: string
  tags?: string[]
  category?: string
  status?: 'draft' | 'published' | 'archived'
}

// 模板相关接口
export interface Template {
  name: string
  filename: string
  content: string
  template_content: string
  created_at: string
  updated_at: string
}

// 文章请求参数接口
export interface ArticleRequestParams {
  filename: string
}

// 文章内容接口
export interface ArticleContent {
  title: string
  content: string
  timestamp?: string
  filename?: string
  [key: string]: any
}

// 爬虫请求参数接口
export interface SpiderArticleRequest {
  url: string
  template_id: string
}

// 爬虫响应数据
export interface SpiderArticleResponse {
  article_id: string
  message: string
}

// API 端点枚举
export enum ApiEndpoints {
  // 模板相关
  GET_TEMPLATES = '/api/handlebars-templates',
  GET_TEMPLATE = '/api/handlebars-templates/:id',
  GET_PRECOMPILED_TEMPLATE = '/api/v1/templates/:id/precompiled',
  GET_ARTICLE_TEMPLATES = '/api/article-templates',
  GET_ARTICLE_TEMPLATES_HTML = '/api/handlebars-templates/render',
  
  // 文章相关
  GET_ARTICLES = '/api/articles',
  GET_ARTICLE = '/api/articles/:id',  // 用于获取单篇文章
  CREATE_ARTICLE = '/api/articles',
  UPDATE_ARTICLE = '/api/articles/:id',
  DELETE_ARTICLE = '/api/articles/:id',
  SPIDER_ARTICLE = '/api/articles/scrape',
  TRANSLATE_ARTICLE = '/api/articles/translate',

  // 本地文章相关
  GET_TEMPLATE_ARTICLES = '/api/article-templates',
  GET_TEMPLATE_ARTICLE = '/api/article-templates/:filename',
  CREATE_TEMPLATE_ARTICLE = '/api/article-templates',
  UPDATE_TEMPLATE_ARTICLE = '/api/article-templates/:filename',
  DELETE_TEMPLATE_ARTICLE = '/api/article-templates/:filename'
} 