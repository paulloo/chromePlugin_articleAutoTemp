import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { logger, LogCategory } from './logger'
import type { ApiResponse, ApiError } from '../types/api'

const API_BASE_URL = process.env.PLASMO_PUBLIC_ARTICLE_API || 'http://localhost:5000'

// 扩展 LogCategory
declare module './logger' {
  export enum LogCategory {
    API = 'API'
  }
}

class ApiClient {
  private client: AxiosInstance
  private static instance: ApiClient

  private constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
  }

  private setupInterceptors(): void {
    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        const requestId = Math.random().toString(36).substring(7)
        logger.info('API 请求开始', {
          category: LogCategory.API,
          data: {
            requestId,
            url: config.url,
            method: config.method,
            params: config.params,
            timestamp: new Date().toISOString()
          }
        })
        return config
      },
      (error) => {
        logger.error('API 请求错误', {
          category: LogCategory.API,
          data: { error }
        })
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const { data } = response
        // 确保响应格式符合我们的标准
        if (!this.isValidApiResponse(data)) {
          // 转换为标准格式
          return {
            ...response,
            data: this.transformResponse(data)
          }
        }
        return response
      },
      (error) => {
        logger.error('API 响应错误', {
          category: LogCategory.API,
          data: {
            error,
            url: error.config?.url,
            method: error.config?.method
          }
        })
        
        const apiError: ApiError = {
          status: 'error',
          message: error.message || '请求失败',
          error: {
            code: error.code || 'UNKNOWN_ERROR',
            details: error.response?.data
          },
          timestamp: new Date().toISOString()
        }
        
        return Promise.reject(apiError)
      }
    )
  }

  private isValidApiResponse(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      (data.status === 'success' || data.status === 'error') &&
      typeof data.message === 'string' &&
      typeof data.timestamp === 'string' &&
      (data.status === 'error' || (data.data && typeof data.data === 'object'))
    )
  }

  private transformResponse(data: any): ApiResponse {
    // 如果数据是数组，包装成标准格式
    if (Array.isArray(data)) {
      return {
        status: 'success',
        message: 'Success',
        data: {
          items: data,
          pagination: null
        },
        timestamp: new Date().toISOString()
      }
    }

    // 如果数据是对象但不是标准格式，包装成标准格式
    if (data && typeof data === 'object') {
      return {
        status: 'success',
        message: 'Success',
        data: {
          items: [data],
          pagination: null
        },
        timestamp: new Date().toISOString()
      }
    }

    // 其他情况
    return {
      status: 'success',
      message: 'Success',
      data: {
        items: [],
        pagination: null
      },
      timestamp: new Date().toISOString()
    }
  }

  // 替换 URL 中的参数
  private replaceUrlParams(url: string, params: Record<string, string>): string {
    let finalUrl = url
    Object.entries(params).forEach(([key, value]) => {
      finalUrl = finalUrl.replace(`:${key}`, value)
    })
    return finalUrl
  }

  // 通用请求方法
  public async request<T>(config: AxiosRequestConfig & { urlParams?: Record<string, string> }): Promise<ApiResponse<T>> {
    try {
      if (config.urlParams) {
        config.url = this.replaceUrlParams(config.url!, config.urlParams)
      }
      
      const response = await this.client.request<ApiResponse<T>>(config)
      return response.data
    } catch (error) {
      if (this.isApiError(error)) {
        throw error
      }
      throw {
        status: 'error',
        message: error instanceof Error ? error.message : '未知错误',
        error: {
          code: 'REQUEST_ERROR',
          details: error
        },
        timestamp: new Date().toISOString()
      } as ApiError
    }
  }

  private isApiError(error: any): error is ApiError {
    return (
      error &&
      error.status === 'error' &&
      typeof error.message === 'string' &&
      error.error &&
      typeof error.error.code === 'string'
    )
  }

  // 便捷方法
  public async get<T>(url: string, config?: Omit<AxiosRequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url })
  }

  public async post<T>(url: string, data?: any, config?: Omit<AxiosRequestConfig, 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data })
  }

  public async put<T>(url: string, data?: any, config?: Omit<AxiosRequestConfig, 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data })
  }

  public async delete<T>(url: string, config?: Omit<AxiosRequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url })
  }
}

export const apiClient = ApiClient.getInstance() 