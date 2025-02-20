import type { DemoData } from "./demo"
import type { ApiResponse } from "../utils/errorHandler"
import type { 
  ArticleListItem, 
  ArticleContent, 
  ArticleData, 
  ArticleRequestParams,
  Template,
  HandlebarsTemplate 
} from "./article"

declare module "@plasmohq/messaging" {
  export interface MessagesMetadata {
    // Demo 消息
    demoMessage: {
      input: { param: string }
      output: ApiResponse<DemoData>
    }

    // 文章列表相关
    "get-local-articles": {
      input: void
      output: ApiResponse<ArticleListItem[]>
    }
    "get-local-article-by-name": {
      input: ArticleRequestParams
      output: ApiResponse<ArticleContent>
    }
    "delete-local-article-by-name": {
      input: ArticleRequestParams
      output: ApiResponse<void>
    }
    "saveArticle": {
      input: ArticleContent
      output: ApiResponse<void>
    }

    // 爬虫和处理相关
    "articleSpider": {
      input: { url: string }
      output: ApiResponse<ArticleData>
    }
    "startTranslate": {
      input: ArticleData
      output: ApiResponse<ArticleData>
    }
    "renderArticle": {
      input: { data: ArticleData; templateName: string }
      output: ApiResponse<void>
    }
    "renderTemplate": {
      input: ArticleData
      output: ApiResponse<void>
    }
    "updateArticleData": {
      input: ArticleData
      output: ApiResponse<void>
    }

    // 模板相关
    "get-templates": {
      input: void
      output: ApiResponse<Template[]>
    }
    "getHandlebarsTemplates": {
      input: void
      output: ApiResponse<Template[]>
    }
    "getHandlebarsTemplate": {
      input: { filename: string }
      output: ApiResponse<Template>
    }
    "createHandlebarsTemplate": {
      input: {
        name: string
        template_content: string
      }
      output: ApiResponse<{
        filename: string
        message: string
      }>
    }
    "updateHandlebarsTemplate": {
      input: {
        filename: string
        template_content: string
      }
      output: ApiResponse<{
        message: string
      }>
    }
    "deleteHandlebarsTemplate": {
      input: { filename: string }
      output: ApiResponse<{
        message: string
      }>
    }
    // 文章模板相关
    "get-article-templates": {
      input: void
      output: ApiResponse<Template[]>
    }
  }
} 