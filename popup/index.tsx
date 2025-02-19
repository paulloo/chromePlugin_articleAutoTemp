import { useRef, useState, useCallback, useEffect } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import "../styles/main.css"

import { useArticleProcessor } from "./hooks/useArticleProcessor"
import { ArticleForm } from "./components/ArticleForm"
import LocalArticles from "./LocalArticles"
import { useLocalArticles } from "./hooks/useLocalArticles"
import { logger, LogCategory } from "../utils/logger"
import type { ErrorResponse, ApiResponse } from "../utils/errorHandler"
import type { ArticleContent } from "../types/article"

function IndexPopup() {
  const {
    loading,
    error,
    loadingState,
    processArticle,
    translateService,
    changeTranslateService
  } = useArticleProcessor()

  const [templateName, setTemplateName] = useState("default")
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)
  const [tabError, setTabError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 获取当前标签页
  const getCurrentTab = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]

      if (!tab?.id) {
        setTabError('未找到当前标签页')
        return
      }

      if (!tab.url?.includes('mp.weixin.qq.com')) {
        setTabError('请在微信公众号编辑器中使用此功能')
        return
      }

      setCurrentTabId(tab.id)
      setTabError(null)
    } catch (error) {
      logger.warn('获取标签页失败', {
        category: LogCategory.ARTICLE,
        data: { error }
      })
      setTabError('获取标签页失败')
    }
  }

  // 监听标签页更新
  useEffect(() => {
    const handleTabUpdate = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tab.url?.includes('mp.weixin.qq.com')) {
        setCurrentTabId(tabId)
        setTabError(null)
      }
    }

    chrome.tabs.onUpdated.addListener(handleTabUpdate)
    getCurrentTab()

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate)
    }
  }, [])

  const handleRender = useCallback(async (templateSource: string, json: any) => {
    if (!currentTabId) {
      throw new Error('请先打开微信公众号编辑器页面')
    }

    logger.info('开始渲染文章', {
      category: LogCategory.ARTICLE,
      data: { 
        title: json.title,
        templateName,
        tabId: currentTabId
      }
    })

    if (!iframeRef.current) {
      logger.error('沙箱 iframe 未就绪', {
        category: LogCategory.ARTICLE
      })
      throw new Error('渲染沙箱未就绪')
    }

    iframeRef.current.contentWindow?.postMessage({
      temp: templateSource,
      data: json,
      tabId: currentTabId
    }, "*")

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          window.removeEventListener('message', handleMessage)
          if (event.data.startsWith('渲染失败:')) {
            reject(new Error(event.data))
          } else {
            resolve(event.data)
          }
        }
      }
      window.addEventListener('message', handleMessage)
    })
  }, [templateName, currentTabId])

  const onSubmit = async (url: string, templateName: string) => {
    if (!currentTabId) {
      setTabError('请在微信公众号编辑器中使用此功能')
      return
    }

    try {
      await processArticle(url, templateName, currentTabId)
    } catch (error) {
      logger.error('处理文章失败', {
        category: LogCategory.ARTICLE,
        data: { error }
      })
    }
  }

  return (
    <div className="w-[600px] min-h-[400px] bg-base text-base">
      <div className="flex flex-col h-full">
        {/* 头部 */}
        <header className="p-4 bg-primary text-white">
          <h1 className="text-xl font-bold">文章处理助手</h1>
        </header>

        {/* 主要内容区 */}
        <main className="flex-1 p-4 overflow-auto">
          <iframe 
            src="sandboxes/mpWixin.html"
            ref={iframeRef} 
            style={{ display: "none" }} 
          />
          
          {/* 文章处理表单 */}
          <section className="mb-6">
            {tabError ? (
              <div className="flex flex-col items-center justify-center gap-4 p-4">
                <p className="text-red-500">{tabError}</p>
                <button
                  className="px-4 py-2 text-sm text-white bg-blue-500 rounded hover:bg-blue-600"
                  onClick={getCurrentTab}
                >
                  刷新插件
                </button>
              </div>
            ) : (
              <ArticleForm
                loading={loading}
                error={error}
                loadingState={loadingState}
                onSubmit={onSubmit}
                translateService={translateService}
                onTranslateServiceChange={changeTranslateService}
              />
            )}
          </section>

          {/* 本地文章列表 */}
          <section className="mt-4">
            <h2 className="text-lg font-semibold mb-3">本地文章</h2>
            <div className="bg-off-base rounded-lg p-4">
              <LocalArticles
                onClick={async (filename: string) => {
                  try {
                    logger.info('开始处理文章', {
                      category: LogCategory.ARTICLE,
                      data: { filename, tabId: currentTabId }
                    })

                    const response = await sendToBackground<{ filename: string }, ApiResponse<ArticleContent>>({
                      name: "get-local-article-by-name",
                      body: { filename }
                    })

                    if (!response.success) {
                      const errorResponse = response as ErrorResponse
                      throw new Error(errorResponse.error.message || '获取文章失败')
                    }

                    await sendToBackground<ArticleContent & { tabId: number }, ApiResponse<void>>({
                      name: "renderArticle",
                      body: { ...response.data, tabId: currentTabId! }
                    })

                    logger.info('文章渲染完成', {
                      category: LogCategory.ARTICLE,
                      data: { filename }
                    })
                  } catch (error) {
                    logger.error('处理文章失败', {
                      category: LogCategory.ARTICLE,
                      data: { 
                        错误类型: error instanceof Error ? error.name : typeof error,
                        错误信息: error instanceof Error ? error.message : String(error)
                      }
                    })
                  }
                }}
              />
            </div>
          </section>
        </main>

        {/* 底部状态栏 */}
        <footer className="p-3 bg-off-base border-t border-gray-200 text-sm text-muted">
          {loading ? '处理中...' : '就绪'}
        </footer>
      </div>
    </div>
  )
}

export default IndexPopup

