import { useEffect, useState, useCallback } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { logger, LogCategory } from "../../utils/logger"
import type { ApiResponse, Template } from "../../types/api"

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

// 重命名为 HandlebarsTemplateSelector，用于选择 Handlebars 模板
export default function HandlebarsTemplateSelector({ value, onChange, disabled = false }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 使用 useCallback 包装 fetchTemplates 函数
  const fetchTemplates = useCallback(async () => {
    if (loading) return // 防止重复请求

    setLoading(true)
    setError(null)

    try {
      logger.info('开始获取 Handlebars 模板列表', {
        category: LogCategory.TEMPLATE,
        data: { timestamp: new Date().toISOString() }
      })

      const response = await sendToBackground<void, ApiResponse<Template>>({
        name: "getHandlebarsTemplates"
      })

      if (response.status === 'error') {
        throw new Error(response.message || '获取 Handlebars 模板列表失败')
      }

      // 确保 response.data 和 response.data.items 存在
      if (!response.data?.items) {
        throw new Error('返回的数据格式不正确')
      }

      logger.info('获取 Handlebars 模板列表成功', {
        category: LogCategory.TEMPLATE,
        data: { 
          templatesCount: response.data.items.length,
          templates: response.data.items.map(t => t.filename),
          timestamp: new Date().toISOString()
        }
      })

      // 确保设置的是数组
      setTemplates(Array.isArray(response.data.items) ? response.data.items : [])

      // 如果没有选中的模板且有可用模板，自动选择第一个
      if (!value && response.data.items.length > 0) {
        onChange(response.data.items[0].name)
      }
    } catch (error) {
      logger.error('获取 Handlebars 模板列表失败', {
        category: LogCategory.TEMPLATE,
        data: { 
          error,
          errorType: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      })
      setError(error instanceof Error ? error.message : '获取 Handlebars 模板列表失败')
      // 确保在错误时设置空数组
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [value, onChange])

  // 仅在组件挂载时获取一次模板列表
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
          onClick={fetchTemplates}
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
        请选择 Handlebars 模板
      </option>
      {Array.isArray(templates) && templates.map((template) => (
        <option key={template.filename} value={template.filename}>
          {template.filename}
        </option>
      ))}
    </select>
  )
} 