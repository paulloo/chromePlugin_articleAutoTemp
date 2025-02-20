import { useState, useCallback } from "react"
import { TranslateServiceSelect } from "./TranslateServiceSelect"
import HandlebarsTemplateSelector from "./HandlebarsTemplateSelector"

import type { ProcessStatus } from "../../types/article"
import { ProgressBar } from "./ProgressBar"
import { ErrorMessage } from "./ErrorMessage"
import { TranslateServiceType } from "../../utils/translate/types"

interface Props {
  onSubmit: (url: string, templateName: string) => Promise<void>
  loading: boolean
  loadingState: {
    status: ProcessStatus
    progress: number
  }
  error: string | null
  translateService: TranslateServiceType
  onTranslateServiceChange: (type: TranslateServiceType) => void
}

export const ArticleForm: React.FC<Props> = ({
  onSubmit,
  loading,
  loadingState,
  error,
  translateService,
  onTranslateServiceChange
}) => {
  const [url, setUrl] = useState("")
  const [templateName, setTemplateName] = useState("default")

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    await onSubmit(url.trim(), templateName)
  }, [url, templateName, onSubmit])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* URL 输入框 */}
      <div>
        <label htmlFor="url" className="block text-sm font-medium mb-1">
          文章链接
        </label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="请输入文章链接 (支持微信公众号和 WikiHow)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          disabled={loading}
          required
        />
      </div>

      {/* 模板选择 */}
      <div>
        <label htmlFor="template" className="block text-sm font-medium mb-1">
          渲染模板
        </label>
        <HandlebarsTemplateSelector
          value={templateName}
          onChange={setTemplateName}
          disabled={loading}
        />
      </div>

      {/* 翻译服务选择 */}
      <div>
        <label htmlFor="translate-service" className="block text-sm font-medium mb-1">
          翻译服务
        </label>
        <TranslateServiceSelect
          value={translateService}
          onChange={onTranslateServiceChange}
          disabled={loading}
        />
      </div>

      {/* 进度条 */}
      {loading && (
        <div className="mt-4">
          <ProgressBar status={loadingState.status} progress={loadingState.progress} />
        </div>
      )}

      {/* 错误信息 */}
      {error && <ErrorMessage message={error} />}

      {/* 提交按钮 */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading ? '处理中...' : '开始处理'}
        </button>
      </div>
    </form>
  )
} 