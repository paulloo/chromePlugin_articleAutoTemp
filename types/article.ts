// 文章列表项接口
export interface ArticleListItem {
  filename: string
  timestamp: string
  title: string
}

// 文章内容接口
export interface ArticleContent {
  title: string
  content: string
  timestamp?: string
  filename?: string
  [key: string]: any
}

// 文章数据接口
export interface ArticleData {
  title: string
  profile: string
  steps: Array<{
    title: string
    step_items: Array<{
      content: string
      children: string[]
      image?: string
    }>
  }>
}

// 文章请求参数接口
export interface ArticleRequestParams {
  filename: string
}

// 文章响应接口
export interface ArticleResponse {
  content?: string
  error?: string
  success: boolean
}

// 文章API路径枚举
export enum ArticleApiEndpoints {
  GET_LIST = 'get-local-articles',
  GET_ARTICLE = 'get-local-article-by-name',
  DELETE_ARTICLE = 'delete-local-article-by-name',
  SAVE_ARTICLE = 'saveArticle',
  SPIDER = 'articleSpider',
  TRANSLATE = 'startTranslate',
  RENDER = 'renderArticle'
}

// 文章操作类型枚举
export enum ArticleActionTypes {
  FETCH = 'FETCH',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

// 文章状态枚举
export enum ArticleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED'
}

// 处理状态枚举
export enum ProcessStatus {
  INIT = 'init',
  SCRAPING = 'scraping',
  WAITING_FILE = 'waiting_file',
  PROCESSING = 'processing',
  TRANSLATING = 'translating',
  RENDERING = 'rendering',
  COMPLETE = 'complete',
  ERROR = 'error'
}

// 文章验证规则
export const ARTICLE_VALIDATION = {
  TITLE: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100
  },
  CONTENT: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 50000
  }
} as const

// 模板接口
export interface Template {
  name: string
  content: string
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

// 默认模板
export const DEFAULT_TEMPLATE = `<section style="width: 100%; display: flex; flex-direction: column; background: #fff;">
  <section style="line-height: 2em; padding: 20px;">
    <section style="display: flex; flex-direction: column;">
      <section style="display: flex; justify-content: center; align-items: center;">
        <img src="https://cdn.ddp.life/9gTc9cOQU74flNC8wiAavP--.png" width="76" alt="Image" />
      </section>
      <section style="text-align: left; border-top: 1px solid #855a27; border-bottom: 1px solid #855a27; padding: 4px 9px;">
        <p style="font-size: 16px; color: #855a27;">{{guide}}</p>
      </section>
    </section>

    <section style="text-align: center; padding: 15px 13px; background: #d0ddff; border-radius: 13px;">
      <span style="font-size: 16px; color: rgb(84, 84, 84);">{{profile}}</span>
    </section>
    
    {{#each steps}}
      <section style="width: 95%; margin: 0 auto; padding: 20px 0;">
        <section style="padding: 0 4px; background: #eaeaea; height: 9px;">
          <p style="font-size: 16px; font-weight: 500; text-align: center; color: #333333;">{{title}}</p>
        </section>
        
        {{#each step_items}}
          <section style="width: 95%; margin: 0 auto; padding: 28px 0 0 24px; background: url(https://cdn.ddp.life/5JOfCL67cZZS6PteqxnQv1V6.png) left top / 110px no-repeat;">
            {{#if img}}
              <img src="{{img}}" style="width: 100%; margin-bottom: 28px;" alt="Step Image" />
            {{/if}}
            <section style="padding-bottom: 20px; background: #333; color: #fff; margin: 14px 0;">
              <p style="font-size: 16px; font-weight: 700; color: #fff;">{{addOne @index}} {{boldFirstSentence content}}</p>
              <ul style="list-style-type: disc; font-size: 16px; color: #fff;">
                {{#each children}}
                  <li>{{this}}</li>
                {{/each}}
              </ul>
            </section>
          </section>
        {{/each}}
      </section>
    {{/each}}

    <section style="width: 100%; text-align: center; padding: 23px 0;">
      <p style="font-size: 14px; color: #444444;">END</p>
    </section>

    <section style="width: 100%; text-align: center;">
      <p style="font-size: 14px; color: #333333; line-height: 20px;">「 往期文章 」</p>
      {{#each history}}
        <p style="text-align: center; font-size: 14px; padding: 12px 0; border-bottom: 1px dashed #333333;">
          <a href="{{url}}" style="color: #555;">{{title}}</a>
        </p>
      {{/each}}
    </section>

    <section style="width: 100%; text-align: center; padding: 10px;">
      <p style="font-size: 14px; color: #333333;">来源：网络（侵删）</p>
      <p style="font-size: 14px; color: #333333;">图片来源：网络（侵删）</p>
    </section>
  </section>
</section>` 