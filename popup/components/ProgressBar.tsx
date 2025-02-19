import React from "react"

interface ProgressBarProps {
  status: string
  progress: number
}

const statusMessages = {
  init: '准备处理...',
  scraping: '正在获取网页内容...',
  processing: '正在处理数据...',
  rendering: '正在渲染文章...',
  complete: '处理完成!',
  error: '处理出错'
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress }) => {
  const message = statusMessages[status as keyof typeof statusMessages] || status

  return (
    <div className="space-y-2">
      {/* 进度条 */}
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-primary transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 状态文本 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{message}</span>
        <span className="text-muted font-medium">{progress}%</span>
      </div>
    </div>
  )
} 