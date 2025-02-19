import { useCallback } from "react"
import { useLocalArticles } from "./hooks/useLocalArticles"
import type { ArticleListItem, ArticleData } from "../types/article"
import { sendToBackground } from "@plasmohq/messaging"
import { logger, LogCategory } from "../utils/logger"
import type { ApiResponse, ErrorResponse } from "../utils/errorHandler"

interface Props {
  onClick?: (filename: string) => void
  onDelete?: (filename: string) => void
}

const LocalArticles = ({ onClick, onDelete }: Props) => {
  const { localArticles, loading, error, refreshLocalArticles } = useLocalArticles()

  const handleRefresh = useCallback(() => {
    logger.info('手动刷新列表', {
      category: LogCategory.ARTICLE,
      data: { 时间戳: new Date().toISOString() }
    })
    refreshLocalArticles()
  }, [refreshLocalArticles])

  const handleClick = useCallback(async (filename: string) => {
    try {
      logger.info('处理文章点击', {
        category: LogCategory.ARTICLE,
        data: { 
          filename,
          时间戳: new Date().toISOString() 
        }
      })

      // 1. 获取文章数据
      const response = await sendToBackground<{ filename: string }, ApiResponse<ArticleData>>({
        name: "get-local-article-by-name",
        body: { filename }
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        throw new Error(errorResponse.error.message || '获取文章失败')
      }

      logger.debug('获取到文章数据', {
        category: LogCategory.ARTICLE,
        data: { 
          filename,
          response,
          时间戳: new Date().toISOString() 
        }
      })

      // 2. 渲染文章
      await sendToBackground({
        name: "renderArticle",
        body: {
          data: response.data,
          templateName: 'default'
        }
      })

      logger.info('文章渲染完成', {
        category: LogCategory.ARTICLE,
        data: { 
          filename,
          时间戳: new Date().toISOString() 
        }
      })

    } catch (error) {
      logger.error('处理文章点击失败', {
        category: LogCategory.ARTICLE,
        data: { 
          错误类型: error instanceof Error ? error.name : typeof error,
          错误信息: error instanceof Error ? error.message : String(error),
          错误栈: error instanceof Error ? error.stack : undefined,
          filename,
          时间戳: new Date().toISOString()
        }
      })
    }
  }, [])

  if (loading) {
    return <div className="p-4 text-center text-gray-600">加载中...</div>
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-500 mb-2">错误: {error}</div>
        <button 
          onClick={handleRefresh}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    )
  }

  if (!localArticles.length) {
    return (
      <div className="p-4">
        <div className="text-gray-600 mb-2">暂无文章</div>
        <button 
          onClick={handleRefresh}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          刷新
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">本地文章列表</h2>
        <button 
          onClick={handleRefresh}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          刷新
        </button>
      </div>
      <div className="space-y-2">
        {localArticles.map((article) => (
          <div 
            key={article.filename}
            className="flex justify-between items-center p-3 bg-white rounded shadow hover:shadow-md transition-shadow"
          >
            <div 
              className="flex-1 cursor-pointer"
              onClick={() => handleClick(article.filename)}
            >
              <div className="font-medium">{article.title}</div>
              <div className="text-sm text-gray-500">{article.filename}</div>
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(article.filename)}
                className="ml-2 px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                删除
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default LocalArticles
