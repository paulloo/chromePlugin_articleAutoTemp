import type { PlasmoMessaging } from "@plasmohq/messaging"

// 错误码枚举
export enum ErrorCode {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

// 错误响应接口
export interface ErrorResponse {
  status: 'error'
  error: {
    message: string
    code: ErrorCode | string
    details?: any
  }
}

// 成功响应接口
export interface SuccessResponse<T> {
  status: 'success'
  data: T
}

// API 响应类型
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

// 创建错误响应的工具函数
export const createErrorResponse = (
  error: any, 
  defaultMessage: string = '操作失败',
  code: ErrorCode = ErrorCode.UNKNOWN_ERROR
): ErrorResponse => ({
  status: 'error',
  error: {
    message: error?.message || defaultMessage,
    code: error?.code || code,
    ...(process.env.NODE_ENV === 'development' && { details: error })
  }
})

// 创建成功响应的工具函数
export const createSuccessResponse = <T>(data: T): SuccessResponse<T> => ({
  status: 'success',
  data
})

// 错误处理中间件
export const withErrorHandling = (handler: PlasmoMessaging.MessageHandler): PlasmoMessaging.MessageHandler => 
  async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('[错误处理]', error)
      res.send(createErrorResponse(error))
    }
  }

// 网络错误处理函数
export const handleNetworkError = (error: any): ErrorResponse => {
  if (error?.isAxiosError) {
    return createErrorResponse(
      error,
      '网络请求失败',
      ErrorCode.NETWORK_ERROR
    )
  }
  return createErrorResponse(error)
} 