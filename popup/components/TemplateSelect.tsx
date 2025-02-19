import { useState, useEffect, useCallback } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { logger, LogCategory } from "../../utils/logger"
import type { ApiResponse, ErrorResponse } from "../../utils/errorHandler"

interface Template {
  name: string
  content: string
  isDefault?: boolean
}

interface Props {
  value: string
  onChange: (templateName: string) => void
  disabled?: boolean
}

export const TemplateSelect = ({ value, onChange, disabled }: Props) => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取模板列表
  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      logger.info('获取模板列表', {
        category: LogCategory.ARTICLE
      })

      const response = await sendToBackground<void, ApiResponse<Template[]>>({
        name: "get-templates"
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        throw new Error(errorResponse.error.message || '获取模板列表失败')
      }

      setTemplates(response.data)
    } catch (error) {
      logger.error('获取模板列表失败', {
        category: LogCategory.ARTICLE,
        data: { error }
      })
      setError(error instanceof Error ? error.message : '获取模板列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 组件加载时获取模板列表
  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value)
  }, [onChange])

  if (loading) {
    return <div className="text-gray-500">加载模板列表...</div>
  }

  if (error) {
    return (
      <div className="text-red-500">
        错误: {error}
        <button 
          onClick={fetchTemplates}
          className="ml-2 text-blue-500 hover:text-blue-700"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium text-gray-700">
        选择模板
      </label>
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
      >
        {templates.map(template => (
          <option 
            key={template.name} 
            value={template.name}
          >
            {template.name} {template.isDefault ? '(默认)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
} 