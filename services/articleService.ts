import { sendToBackground } from "@plasmohq/messaging"
import type { ApiResponse, ErrorResponse } from "../utils/errorHandler"
import type { ArticleListItem, ArticleContent, ArticleRequestParams, ArticleData } from "../types/article"
import { logger, LogCategory } from "../utils/logger"
import { ArticleApiEndpoints } from "../types/article"
import { TranslateServiceType } from "../utils/translate/types"

interface ProcessLocalArticleParams {
  articleData: ArticleContent
  templateId: string
  tabId: number
}

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
  async spiderArticle({ url, templateId, tabId }: { url: string; templateId: string; tabId?: number }): Promise<ArticleData> {
    logger.info('开始处理文章', {
      category: LogCategory.ARTICLE,
      data: { 
        url,
        templateId,
        timestamp: new Date().toISOString()
      }
    })

    try {
      // 先尝试从本地获取已爬取的文章
      const cachedArticle = await sendToBackground<{ url: string }, ApiResponse<ArticleData>>({
        name: "get-cached-article",
        body: { url }
      })
      console.log("cachedArticle: ", cachedArticle)
      // 如果找到缓存的文章，直接返回
      if (cachedArticle.success && cachedArticle.data) {
        logger.info('使用缓存的文章数据', {
          category: LogCategory.ARTICLE,
          data: { 
            url,
            templateId,
            title: cachedArticle.data.title,
            timestamp: new Date().toISOString()
          }
        })
        return cachedArticle.data
      }

      // 如果没有缓存，则进行爬取
      logger.info('开始爬取文章', {
        category: LogCategory.ARTICLE,
        data: { 
          url,
          templateId,
          timestamp: new Date().toISOString()
        }
      })

      const response = await sendToBackground<{ url: string; templateId: string }, ApiResponse<ArticleData>>({
        name: "articleSpider",
        body: { url, templateId }
      })

      logger.debug('爬虫响应', {
        category: LogCategory.ARTICLE,
        data: { 
          response,
          timestamp: new Date().toISOString()
        }
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        logger.error('爬取文章失败', {
          category: LogCategory.ARTICLE,
          data: { 
            url,
            templateId,
            error: errorResponse,
            timestamp: new Date().toISOString()
          }
        })
        throw new Error('errorResponse.error')
      }

      // 获取爬取的文章数据
      const articleData = response.data

      // 开始翻译文章
      logger.info('开始翻译文章', {
        category: LogCategory.ARTICLE,
        data: { 
          url,
          title: articleData.title,
          timestamp: new Date().toISOString()
        }
      })

      const translatedResponse = await sendToBackground<{ data: ArticleData }, ApiResponse<ArticleData>>({
        name: "startTranslate",
        body: { data: articleData }
      })

      if (!translatedResponse.success) {
        const errorResponse = translatedResponse as ErrorResponse
        logger.error('翻译文章失败', {
          category: LogCategory.ARTICLE,
          data: { 
            url,
            templateId,
            error: errorResponse.error,
            timestamp: new Date().toISOString()
          }
        })
        throw new Error(errorResponse.error.message)
      }

      // 确保翻译后的数据格式正确
      const translatedData: ArticleData = {
        title: translatedResponse.data.title || articleData.title,
        profile: translatedResponse.data.profile || articleData.profile,
        steps: translatedResponse.data.steps.map((step, stepIndex) => ({
          title: step.title || articleData.steps[stepIndex].title,
          step_items: step.step_items.map((item, itemIndex) => ({
            content: item.content || articleData.steps[stepIndex].step_items[itemIndex].content,
            children: item.children || articleData.steps[stepIndex].step_items[itemIndex].children,
            image: articleData.steps[stepIndex].step_items[itemIndex].image // 保持原始图片链接
          }))
        }))
      }

      // 保存翻译后的文章到缓存
      await sendToBackground<{ url: string; data: ArticleData }, ApiResponse<void>>({
        name: "cacheArticle",
        body: { url, data: translatedData }
      })

      logger.info('文章处理完成', {
        category: LogCategory.ARTICLE,
        data: { 
          url,
          templateId,
          title: translatedData.title,
          timestamp: new Date().toISOString()
        }
      })

      // 如果提供了 tabId，则渲染文章
      if (tabId) {
        logger.info('开始渲染文章', {
          category: LogCategory.ARTICLE,
          data: { 
            url,
            templateId,
            tabId,
            timestamp: new Date().toISOString()
          }
        })

        await sendToBackground<{ data: ArticleData; templateId: string; tabId: number }, ApiResponse<void>>({
          name: "renderArticle",
          body: { 
            data: translatedData,
            templateId,
            tabId
          }
        })

        logger.info('渲染文章完成', {
          category: LogCategory.ARTICLE,
          data: { 
            url,
            templateId,
            tabId,
            timestamp: new Date().toISOString()
          }
        })
      }

      return translatedData
    } catch (error) {
      logger.error('文章处理失败', {
        category: LogCategory.ARTICLE,
        data: { 
          url,
          templateId,
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      })
      throw error
    }
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
  async renderArticle(data: ArticleData, templateId: string, tabId: number): Promise<void> {
    try {
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const currentTab = tabs[0]

      if (!currentTab?.id || !currentTab.url?.includes('mp.weixin.qq.com')) {
        throw new Error('请在微信公众号编辑器中使用此功能')
      }

      logger.info('开始渲染文章', {
        category: LogCategory.ARTICLE,
        data: { 
          title: data.title,
          templateId,
          tabId: currentTab.id,
          timestamp: new Date().toISOString()
        }
      })

      const response = await sendToBackground<{ data: ArticleData; templateId: string; tabId: number }, ApiResponse<void>>({
        name: "renderArticle",
        body: { 
          data, 
          templateId, 
          tabId: currentTab.id 
        }
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        throw new Error(errorResponse.error?.message || '渲染文章失败')
      }

      logger.info('渲染文章成功', {
        category: LogCategory.ARTICLE,
        data: { 
          title: data.title,
          templateId,
          tabId: currentTab.id,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      logger.error('渲染文章失败', {
        category: LogCategory.ARTICLE,
        data: { 
          title: data.title,
          templateId,
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      })
      throw error
    }
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

  // 处理本地文章
  async processLocalArticle({ articleData, templateId, tabId }: ProcessLocalArticleParams): Promise<void> {
    try {
      logger.info('开始处理本地文章', {
        category: LogCategory.ARTICLE,
        data: { 
          title: articleData.title,
          templateId,
          tabId,
          timestamp: new Date().toISOString()
        }
      })

      // 1. 格式化文章数据
      const formattedData: ArticleData = {
        title: articleData.title,
        profile: articleData.profile || '',
        steps: articleData.steps || [],
        guide: articleData.guide || "点击上方蓝字关注我们"
      }

      // 2. 翻译处理（如果需要）
      let translatedData = formattedData
      if (articleData.needTranslation) {
        logger.info('开始翻译本地文章', {
          category: LogCategory.ARTICLE,
          data: { 
            title: formattedData.title,
            timestamp: new Date().toISOString()
          }
        })

        translatedData = await this.translateArticle(formattedData)
      }

      // 3. 缓存处理
      try {
        await sendToBackground<{ url: string; data: ArticleData }, ApiResponse<void>>({
          name: "cacheArticle",
          body: { 
            url: `local:${articleData.filename || articleData.title}`,
            data: translatedData 
          }
        })
      } catch (error) {
        logger.warn('缓存本地文章失败，继续处理', {
          category: LogCategory.ARTICLE,
          data: { 
            title: translatedData.title,
            error,
            timestamp: new Date().toISOString()
          }
        })
      }

      // 4. 渲染处理
      await this.renderArticle(translatedData, templateId, tabId)

      logger.info('本地文章处理完成', {
        category: LogCategory.ARTICLE,
        data: { 
          title: translatedData.title,
          templateId,
          tabId,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      logger.error('处理本地文章失败', {
        category: LogCategory.ARTICLE,
        data: { 
          title: articleData.title,
          templateId,
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      })
      throw error
    }
  }
}

// 导出单例实例
export const articleService = new ArticleService() 