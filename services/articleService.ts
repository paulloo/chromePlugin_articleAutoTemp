import { sendToBackground } from "@plasmohq/messaging"
import type { ApiResponse, ErrorResponse } from "../utils/errorHandler"
import type { ArticleListItem, ArticleContent, ArticleRequestParams, ArticleData } from "../types/article"
import { logger, LogCategory } from "../utils/logger"
import { ArticleApiEndpoints } from "../types/article"
import { TranslateServiceType } from "../utils/translate/types"

// 请求服务类
class ArticleService {
  // 获取文章列表
  async getArticleList() {
    try {
      logger.info('开始获取文章列表', { 
        category: LogCategory.ARTICLE,
        data: {
          endpoint: ArticleApiEndpoints.GET_LIST,
          时间戳: new Date().toISOString()
        }
      })

      const response = await sendToBackground<void, ApiResponse<ArticleListItem[]>>({
        name: ArticleApiEndpoints.GET_LIST
      }).catch(error => {
        logger.error('sendToBackground 调用失败', {
          category: LogCategory.ARTICLE,
          data: { 
            error,
            errorType: typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
          }
        })
        throw error
      })

      logger.debug('获取文章列表响应', {
        category: LogCategory.ARTICLE,
        data: { 
          response,
          responseType: typeof response,
          responseJSON: JSON.stringify(response, null, 2)
        }
      })

      if (!response?.success) {
        const errorResponse = response as ErrorResponse
        logger.error('获取文章列表失败', {
          category: LogCategory.ARTICLE,
          data: { error: errorResponse.error }
        })
        throw new Error(errorResponse?.error?.message || '获取文章列表失败')
      }

      // 确保响应数据是数组
      const articles = Array.isArray(response.data) ? response.data : []

      // 记录实际获取到的文章数量
      logger.info('获取文章列表成功', {
        category: LogCategory.ARTICLE,
        data: { 
          文章数量: articles.length,
          文章列表: articles 
        }
      })

      return articles
    } catch (error) {
      logger.error('获取文章列表出错', {
        category: LogCategory.ARTICLE,
        data: { 
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        }
      })
      throw error
    }
  }

  // 获取单篇文章
  async getArticle(params: ArticleRequestParams) {
    logger.info('获取文章', {
      category: LogCategory.ARTICLE,
      data: { params }
    })

    const response = await sendToBackground<ArticleRequestParams, ApiResponse<ArticleContent>>({
      name: ArticleApiEndpoints.GET_ARTICLE,
      body: params
    })

    if (!response.success) {
      const errorResponse = response as ErrorResponse
      logger.error('获取文章失败', {
        category: LogCategory.ARTICLE,
        data: { params, error: errorResponse.error }
      })
      throw new Error(errorResponse.error.message)
    }

    logger.info('获取文章成功', {
      category: LogCategory.ARTICLE,
      data: { filename: params.filename }
    })

    return response.data
  }

  // 删除文章
  async deleteArticle(params: ArticleRequestParams) {
    logger.info('删除文章', {
      category: LogCategory.ARTICLE,
      data: { params }
    })

    const response = await sendToBackground<ArticleRequestParams, ApiResponse<void>>({
      name: ArticleApiEndpoints.DELETE_ARTICLE,
      body: params
    })

    if (!response.success) {
      const errorResponse = response as ErrorResponse
      logger.error('删除文章失败', {
        category: LogCategory.ARTICLE,
        data: { params, error: errorResponse.error }
      })
      throw new Error(errorResponse.error.message)
    }

    logger.info('删除文章成功', {
      category: LogCategory.ARTICLE,
      data: { filename: params.filename }
    })
  }

  // 保存文章
  async saveArticle(params: ArticleContent) {
    logger.info('保存文章', {
      category: LogCategory.ARTICLE,
      data: { params }
    })

    const response = await sendToBackground<ArticleContent, ApiResponse<void>>({
      name: ArticleApiEndpoints.SAVE_ARTICLE,
      body: params
    })

    if (!response.success) {
      const errorResponse = response as ErrorResponse
      logger.error('保存文章失败', {
        category: LogCategory.ARTICLE,
        data: { params, error: errorResponse.error }
      })
      throw new Error(errorResponse.error.message)
    }

    logger.info('保存文章成功', {
      category: LogCategory.ARTICLE,
      data: { title: params.title }
    })
  }

  // 爬取文章
  async spiderArticle(url: string, type: string): Promise<ArticleData> {
    logger.info('开始爬取文章', {
      category: LogCategory.ARTICLE,
      data: { url }
    })

    const response = await sendToBackground<{ url: string; type: string }, ApiResponse<ArticleData>>({
      name: "articleSpider",
      body: { url, type }
    })

    logger.debug('爬虫响应', {
      category: LogCategory.ARTICLE,
      data: { response }
    })

    if (!response.success) {
      const errorResponse = response as ErrorResponse
      logger.error('爬取文章失败', {
        category: LogCategory.ARTICLE,
        data: { url, error: errorResponse.error }
      })
      throw new Error(errorResponse.error.message)
    }

    if (!response.data) {
      logger.error('爬虫返回数据为空', {
        category: LogCategory.ARTICLE,
        data: { url, response }
      })
      throw new Error('爬虫返回数据为空')
    }

    logger.info('爬取文章成功', {
      category: LogCategory.ARTICLE,
      data: { url, title: response.data.title }
    })

    return response.data
  }

  // 翻译文章
  async translateArticle(data: ArticleData, serviceType: TranslateServiceType = TranslateServiceType.GOOGLE): Promise<ArticleData> {
    logger.info('开始翻译文章', {
      category: LogCategory.ARTICLE,
      data: { title: data.title }
    })

    const response = await sendToBackground<{ data: ArticleData; serviceType: TranslateServiceType }, ApiResponse<ArticleData>>({
      name: "startTranslate",
      body: { data, serviceType }
    })

    if (!response.success) {
      const errorResponse = response as ErrorResponse
      logger.error('翻译文章失败', {
        category: LogCategory.ARTICLE,
        data: { title: data.title, error: errorResponse.error }
      })
      throw new Error(errorResponse.error.message)
    }

    logger.info('翻译文章成功', {
      category: LogCategory.ARTICLE,
      data: { title: response.data.title }
    })

    return response.data
  }

  // 渲染文章
  async renderArticle(data: ArticleData, templateName: string, tabId: number): Promise<void> {
    logger.info('开始渲染文章', {
      category: LogCategory.ARTICLE,
      data: { title: data.title }
    })

    const response = await sendToBackground<{ data: ArticleData; templateName: string; tabId: number }, ApiResponse<void>>({
      name: "renderArticle",
      body: { data, templateName, tabId }
    })

    if (!response.success) {
      const errorResponse = response as ErrorResponse
      logger.error('渲染文章失败', {
        category: LogCategory.ARTICLE,
        data: { title: data.title, error: errorResponse.error }
      })
      throw new Error(errorResponse.error.message)
    }

    logger.info('渲染文章成功', {
      category: LogCategory.ARTICLE,
      data: { title: data.title }
    })
  }

  // 验证文章数据
  private validateArticleData(data: any): data is ArticleData {
    if (!data || typeof data !== 'object') {
      logger.error('数据不是对象类型', {
        category: LogCategory.ARTICLE,
        data: { invalidData: data }
      })
      return false
    }

    if (typeof data.title !== 'string' || !data.title) {
      logger.error('标题无效', {
        category: LogCategory.ARTICLE,
        data: { title: data.title }
      })
      return false
    }

    if (typeof data.profile !== 'string' || !data.profile) {
      logger.error('简介无效', {
        category: LogCategory.ARTICLE,
        data: { profile: data.profile }
      })
      return false
    }

    if (!Array.isArray(data.steps)) {
      logger.error('步骤不是数组', {
        category: LogCategory.ARTICLE,
        data: { steps: data.steps }
      })
      return false
    }

    return data.steps.every((step, stepIndex) => {
      if (!step || typeof step !== 'object') {
        logger.error(`步骤 ${stepIndex + 1} 无效`, {
          category: LogCategory.ARTICLE,
          data: { step }
        })
        return false
      }

      if (typeof step.title !== 'string' || !step.title) {
        logger.error(`步骤 ${stepIndex + 1} 标题无效`, {
          category: LogCategory.ARTICLE,
          data: { stepTitle: step.title }
        })
        return false
      }

      if (!Array.isArray(step.step_items)) {
        logger.error(`步骤 ${stepIndex + 1} 的项目不是数组`, {
          category: LogCategory.ARTICLE,
          data: { stepItems: step.step_items }
        })
        return false
      }

      return step.step_items.every((item, itemIndex) => {
        if (!item || typeof item !== 'object') {
          logger.error(`步骤 ${stepIndex + 1} 的第 ${itemIndex + 1} 项无效`, {
            category: LogCategory.ARTICLE,
            data: { item }
          })
          return false
        }

        if (typeof item.content !== 'string' || !item.content) {
          logger.error(`步骤 ${stepIndex + 1} 的第 ${itemIndex + 1} 项内容无效`, {
            category: LogCategory.ARTICLE,
            data: { itemContent: item.content }
          })
          return false
        }

        if (!Array.isArray(item.children)) {
          logger.error(`步骤 ${stepIndex + 1} 的第 ${itemIndex + 1} 项的子项不是数组`, {
            category: LogCategory.ARTICLE,
            data: { itemChildren: item.children }
          })
          return false
        }

        return true
      })
    })
  }
}

// 导出单例实例
export const articleService = new ArticleService() 