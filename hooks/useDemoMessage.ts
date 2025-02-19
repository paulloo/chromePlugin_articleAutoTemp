import { sendToBackground } from "@plasmohq/messaging"
import { logger, LogCategory } from "../utils/logger"
import type { ApiResponse, ErrorResponse } from "../utils/errorHandler"
import { useState, useCallback } from "react"
import type { DemoData } from "../types/demo"

export const useDemoMessage = () => {
  const [data, setData] = useState<DemoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (param: string) => {
    const requestId = Math.random().toString(36).substring(7)
    setLoading(true)
    setError(null)

    logger.info('开始发送消息', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        param,
        时间戳: new Date().toISOString()
      }
    })

    try {
      // 使用 Plasmo 的 sendToBackground
      const response = await sendToBackground<{ param: string }, ApiResponse<DemoData>>({
        name: "demoMessage",
        body: { param }
      })
      debugger
      if (!response) {
        throw new Error('未收到响应')
      }

      return handleResponse(response, requestId)
    } catch (error) {
      logger.error('发送消息失败', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          error,
          错误类型: typeof error,
          错误信息: error.message,
          错误栈: error.stack,
          时间戳: new Date().toISOString()
        }
      })
      setError(error.message || '发送消息失败')
      setLoading(false)
      throw error
    }
  }, [])

  // 处理响应的辅助函数
  const handleResponse = (response: any, requestId: string) => {
    logger.debug('开始处理响应', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        响应类型: typeof response,
        响应内容: response,
        时间戳: new Date().toISOString()
      }
    })

    if (!response.success || response.error) {
      const errorMessage = response.error?.message || '消息处理失败'
      logger.error('测试消息失败', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          error: response.error,
          时间戳: new Date().toISOString()
        }
      })
      throw new Error(errorMessage)
    }

    if (!response.data) {
      logger.error('测试消息返回数据为空', {
        category: LogCategory.ARTICLE,
        data: { 
          requestId,
          response,
          responseJSON: JSON.stringify(response, null, 2),
          时间戳: new Date().toISOString()
        }
      })
      throw new Error('测试消息返回数据为空')
    }

    setData(response.data)
    setLoading(false)
    setError(null)

    logger.info('测试消息成功', {
      category: LogCategory.ARTICLE,
      data: { 
        requestId,
        responseData: response.data,
        responseDataJSON: JSON.stringify(response.data, null, 2),
        时间戳: new Date().toISOString()
      }
    })

    return response.data
  }

  return {
    loading,
    error,
    data,
    sendMessage
  }
} 