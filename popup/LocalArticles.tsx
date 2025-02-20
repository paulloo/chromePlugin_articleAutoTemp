import { useEffect, useState, useCallback } from "react"
import { useLocalArticles } from "../hooks/useLocalArticles"
import type { ArticleListItem, ArticleData } from "../types/article"
import { sendToBackground } from "@plasmohq/messaging"
import { logger, LogCategory } from "../utils/logger"
import type { ApiResponse, ErrorResponse } from "../utils/errorHandler"
import type { ArticleContent } from "../types/article"

interface Props {
  currentTabId: number | null
  templateId: string
  onClick: (id: string) => void
  onDelete?: (id: string) => void
}

export default function LocalArticles({ currentTabId, templateId, onClick, onDelete }: Props) {
  const { localArticles, loading, error, refreshLocalArticles } = useLocalArticles()

  const handleClick = useCallback(async (id: string) => {
    try {
      if (!currentTabId) {
        logger.warn('未找到当前标签页', {
          category: LogCategory.ARTICLE,
          data: { id }
        })
        return
      }

      if (!templateId) {
        throw new Error('请先选择一个模板')
      }

      logger.info('开始处理本地文章', {
        category: LogCategory.ARTICLE,
        data: { 
          id,
          templateId,
          tabId: currentTabId,
          timestamp: new Date().toISOString()
        }
      })

      const response = await sendToBackground<{ id: string }, ApiResponse<ArticleContent>>({
        name: "get-local-article-by-name",
        body: { id }
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        throw new Error(errorResponse.error.details || '获取文章失败')
      }

      const res = await sendToBackground({
        name: "renderArticle",
        body: {
          data: response.data,
          templateId,
          tabId: currentTabId
        }
      })
      logger.info('文章渲染完成', {
        category: LogCategory.ARTICLE,
        data: { 
          id,
          templateId,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      logger.error('处理文章失败', {
        category: LogCategory.ARTICLE,
        data: { 
          错误类型: error instanceof Error ? error.name : typeof error,
          错误信息: error instanceof Error ? error.message : String(error),
          id,
          templateId,
          timestamp: new Date().toISOString()
        }
      })
      throw error
    }
  }, [currentTabId, templateId])

  if (loading) {
    return <div className="text-center text-gray-500">加载中...</div>
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        {error}
        <button
          className="ml-2 text-blue-500 hover:text-blue-600"
          onClick={refreshLocalArticles}
        >
          重试
        </button>
      </div>
    )
  }

  if (!localArticles?.length) {
    return (
      <div className="text-center text-gray-500">
        暂无本地文章
        <button
          className="ml-2 text-blue-500 hover:text-blue-600"
          onClick={refreshLocalArticles}
        >
          刷新
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">本地文章列表</h2>
        <button 
          onClick={refreshLocalArticles}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          刷新
        </button>
      </div>
      <div className="space-y-2">
        {localArticles.map((article) => (
          <div
            key={article.title}
            className="flex items-center justify-between p-2 bg-white rounded hover:bg-gray-50"
          >
            <span className="text-sm truncate flex-1">{article.title}</span>
            <button
              className="ml-2 text-sm text-blue-500 hover:text-blue-600"
              onClick={() => handleClick(article.id)}
              disabled={!currentTabId || !templateId}
            >
              使用
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
