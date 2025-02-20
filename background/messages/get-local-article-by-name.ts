import type { PlasmoMessaging } from "@plasmohq/messaging"
import { logger, LogCategory } from "../../utils/logger"
import { apiClient } from "../../utils/api"
import { ApiEndpoints } from "../../types/api"
import type { ArticleContent, ArticleRequestParams, ArticleData, ApiResponse } from "../../types/api"
import axios from "axios"

// 数据清理函数
const cleanArticleData = (rawData: any): ArticleData => {
  // 清理步骤数据
  const cleanSteps = (rawSteps: any[]) => {
    return rawSteps
      .filter(step => step.title || step.items?.length)
      .map(step => ({
        title: step.title || "",
        step_items: (step.items || [])
          .filter(item => item.content || item.image)
          .map(item => ({
            content: item.content || "",
            children: []
          }))
      }))
  }

  return {
    title: rawData.title || "",
    profile: rawData.profile || "",
    steps: rawData.steps ? cleanSteps(rawData.steps) : []
  }
}

const handler: PlasmoMessaging.MessageHandler<ArticleRequestParams, ApiResponse<ArticleData>> = async (req, res) => {
  const requestId = Math.random().toString(36).substring(7)
  const { id } = req.body

  try {
    logger.info('开始获取文章', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        id,
        timestamp: new Date().toISOString()
      }
    })

    if (!id) {
      throw new Error('文件名不能为空')
    }

    try {
      const response = await apiClient.request<ArticleData>({
        method: 'GET',
        url: ApiEndpoints.GET_ARTICLE,
        urlParams: { id }
      })

      logger.debug('获取到原始数据', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          rawData: response.data,
          timestamp: new Date().toISOString()
        }
      })

      // // 清理和格式化数据
      // const cleanedData = cleanArticleData(response.data.items[0])

      // logger.debug('清理后的数据', {
      //   category: LogCategory.ARTICLE,
      //   data: { 
      //     requestId,
      //     cleanedData,
      //     timestamp: new Date().toISOString()
      //   }
      // })

      res.send({
        success: true,
        // message: '获取文章成功',
        data: response.data,
        // timestamp: new Date().toISOString()
      })
    } catch (error) {
      // 处理 axios 错误
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const errorMessage = error.response?.data?.message || error.message

        logger.error('API请求失败', {
          category: LogCategory.ARTICLE,
          data: { 
            requestId,
            status,
            errorMessage,
            url: error.config?.url,
            timestamp: new Date().toISOString()
          }
        })

        // 处理特定状态码
        if (status === 404) {
          res.send({
            status: 'error',
            message: `文章 "${id}" 不存在`,
            data: {
              items: [],
              pagination: null
            },
            timestamp: new Date().toISOString()
          })
          return
        }

        // 其他 HTTP 错误
        res.send({
          status: 'error',
          message: `API请求失败: ${errorMessage}`,
          data: {
            items: [],
            pagination: null
          },
          timestamp: new Date().toISOString()
        })
        return
      }

      // 重新抛出非 axios 错误
      throw error
    }
  } catch (error) {
    logger.error('获取文章失败', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        id,
        error,
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    })

    // 如果是 API 错误，直接返回
    if ((error as any).status === 'error') {
      res.send(error)
      return
    }

    // 其他错误转换为标准格式
    res.send({
      status: 'error',
      message: error instanceof Error ? error.message : '获取文章失败',
      data: {
        items: [],
        pagination: null
      },
      timestamp: new Date().toISOString()
    })
  }
}

export default handler
