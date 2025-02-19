import { useState, useCallback, useRef, useEffect } from "react"
import { logger, LogCategory } from "../utils/logger"

export interface RequestState<T> {
  data: T | null
  loading: boolean
  error: string | null
  timestamp: number | null
}

export interface RequestOptions {
  // 是否自动执行
  auto?: boolean
  // 缓存时间（毫秒）
  cacheTime?: number
  // 重试次数
  retryCount?: number
  // 重试延迟（毫秒）
  retryDelay?: number
  // 防抖时间（毫秒）
  debounceTime?: number
  // 请求标识（用于日志）
  requestId?: string
}

const defaultOptions: Required<RequestOptions> = {
  auto: true,
  cacheTime: 0,
  retryCount: 0,
  retryDelay: 1000,
  debounceTime: 0,
  requestId: ''
}

export function useRequest<TData = any, TParams = void>(
  requestFn: (params: TParams) => Promise<TData>,
  options: RequestOptions = {}
) {
  const mergedOptions = { ...defaultOptions, ...options }
  const [state, setState] = useState<RequestState<TData>>({
    data: null,
    loading: false,
    error: null,
    timestamp: null
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const retryCountRef = useRef(0)
  const debounceTimerRef = useRef<NodeJS.Timeout>()
  const requestIdRef = useRef(mergedOptions.requestId || Math.random().toString(36).substring(7))

  // 清理函数
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      logger.debug('请求被取消', {
        category: LogCategory.REQUEST,
        data: { requestId: requestIdRef.current }
      })
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // 执行请求
  const execute = useCallback(async (params: TParams) => {
    cleanup()
    
    logger.info('开始执行请求', {
      category: LogCategory.REQUEST,
      data: {
        requestId: requestIdRef.current,
        params,
        options: mergedOptions
      }
    })
    
    // 防抖处理
    if (mergedOptions.debounceTime > 0) {
      logger.debug('请求防抖处理', {
        category: LogCategory.REQUEST,
        data: {
          requestId: requestIdRef.current,
          debounceTime: mergedOptions.debounceTime
        }
      })
      return new Promise<TData>((resolve, reject) => {
        debounceTimerRef.current = setTimeout(async () => {
          try {
            const result = await executeRequest(params)
            resolve(result)
          } catch (error) {
            reject(error)
          }
        }, mergedOptions.debounceTime)
      })
    }

    return executeRequest(params)
  }, [mergedOptions.debounceTime, cleanup])

  // 实际执行请求的函数
  const executeRequest = async (params: TParams): Promise<TData> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      abortControllerRef.current = new AbortController()

      logger.debug('执行请求', {
        category: LogCategory.REQUEST,
        data: {
          requestId: requestIdRef.current,
          params,
          retryCount: retryCountRef.current
        }
      })

      const result = await requestFn(params)
      
      logger.info('请求成功', {
        category: LogCategory.REQUEST,
        data: {
          requestId: requestIdRef.current,
          result
        }
      })

      setState({
        data: result,
        loading: false,
        error: null,
        timestamp: Date.now()
      })
      retryCountRef.current = 0
      return result
    } catch (error) {
      // 如果是取消请求，不处理错误
      if (error.name === 'AbortError') {
        return state.data as TData
      }

      logger.error('请求失败', {
        category: LogCategory.REQUEST,
        data: {
          requestId: requestIdRef.current,
          error,
          retryCount: retryCountRef.current
        }
      })

      // 重试逻辑
      if (retryCountRef.current < mergedOptions.retryCount) {
        retryCountRef.current++
        logger.warn('请求重试', {
          category: LogCategory.REQUEST,
          data: {
            requestId: requestIdRef.current,
            retryCount: retryCountRef.current,
            maxRetries: mergedOptions.retryCount
          }
        })
        await new Promise(resolve => setTimeout(resolve, mergedOptions.retryDelay))
        return executeRequest(params)
      }

      const errorMessage = error instanceof Error ? error.message : '请求失败'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }

  // 重置状态
  const reset = useCallback(() => {
    logger.debug('重置请求状态', {
      category: LogCategory.REQUEST,
      data: { requestId: requestIdRef.current }
    })
    cleanup()
    setState({
      data: null,
      loading: false,
      error: null,
      timestamp: null
    })
    retryCountRef.current = 0
  }, [cleanup])

  // 组件卸载时清理
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    ...state,
    execute,
    reset,
    // 是否是新鲜数据
    isFresh: state.timestamp
      ? Date.now() - state.timestamp < mergedOptions.cacheTime
      : false
  }
} 