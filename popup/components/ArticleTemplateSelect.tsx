import { useState, useEffect, useCallback, useRef } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { logger, LogCategory } from "../../utils/logger"
import type { ApiResponse, Template } from "../../types/api"

interface Props {
  value: string
  onChange: (templateName: string) => void
  disabled?: boolean
}

// 重命名为 ArticleTemplateSelect，用于选择文章模板
export const ArticleTemplateSelect = ({ value, onChange, disabled }: Props) => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  // 获取文章模板列表
  const fetchTemplates = useCallback(async () => {
    // 防止重复初始化
    if (initialized.current) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      logger.info('获取文章模板列表', {
        category: LogCategory.TEMPLATE,
        data: { timestamp: new Date().toISOString() }
      })

      const response = await sendToBackground<void, ApiResponse<Template>>({
        name: "get-article-templates"
      })

      if (response.status === 'error') {
        throw new Error(response.message || '获取文章模板列表失败')
      }

      if (!response.data?.items) {
        throw new Error('返回的数据格式不正确')
      }

      logger.info('获取文章模板列表成功', {
        category: LogCategory.TEMPLATE,
        data: { 
          templatesCount: response.data.items.length,
          templates: response.data.items.map(t => t.name),
          timestamp: new Date().toISOString()
        }
      })

      setTemplates(response.data.items)

      // 如果没有选中的模板且有可用模板，自动选择第一个
      if (!value && response.data.items.length > 0) {
        onChange(response.data.items[0].id)
      }

      // 标记为已初始化
      initialized.current = true
    } catch (error) {
      logger.error('获取文章模板列表失败', {
        category: LogCategory.TEMPLATE,
        data: { 
          error,
          errorType: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      })
      setError(error instanceof Error ? error.message : '获取文章模板列表失败')
      // 初始化失败时重置标记
      initialized.current = false
    } finally {
      setLoading(false)
    }
  }, []) // 移除 value 和 onChange 依赖

  // 手动刷新模板列表
  const refreshTemplates = useCallback(async () => {
    // 重置初始化标记
    initialized.current = false
    await fetchTemplates()
  }, [fetchTemplates])

  // 组件加载时获取模板列表
  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  if (loading) {
    return (
      <select
        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-gray-500"
        disabled
      >
        <option>加载中...</option>
      </select>
    )
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        {error}
        <button
          className="ml-2 text-blue-500 hover:text-blue-600"
          onClick={refreshTemplates}
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <select
      className="w-full p-2 border border-gray-300 rounded hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="" disabled>
        请选择文章模板
      </option>
      {templates.map((template) => (
        <option key={template.name} value={template.id}>
          {template.name}
        </option>
      ))}
    </select>
  )
} 