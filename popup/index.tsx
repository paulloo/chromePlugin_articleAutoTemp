import { useRef, useState, useCallback, useEffect } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import "../styles/main.css"
import { Tabs, Card, Button, Alert } from "flowbite-react"
import type { TabsRef } from "flowbite-react"
import { HiTemplate, HiDocument, HiCog } from "react-icons/hi"
import { TranslateServiceType } from "../utils/translate/types"

import { useArticleProcessor } from "../hooks/useArticleProcessor"
import { ArticleForm } from "./components/ArticleForm"
import { ArticleTemplateSelect } from "./components/ArticleTemplateSelect"
import LocalArticles from "./LocalArticles"
import { logger, LogCategory } from "../utils/logger"
import type { ErrorResponse, ApiResponse } from "../utils/errorHandler"
import type { ArticleContent } from "../types/article"
import { articleService } from "../services/articleService"

function IndexPopup() {
  const {
    loading,
    error,
    loadingState,
    processArticle,
    translateService,
    changeTranslateService
  } = useArticleProcessor()

  const [templateName, setTemplateName] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)
  const [tabError, setTabError] = useState<string | null>(null)

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

  const onSubmit = async (url: string) => {
    if (!currentTabId) {
      setTabError('请在微信公众号编辑器中使用此功能')
      return
    }

    if (!templateId) {
      logger.error('未选择模板', {
        category: LogCategory.ARTICLE,
        data: { 
          url,
          timestamp: new Date().toISOString()
        }
      })
      throw new Error('请先选择一个模板')
    }

    try {
      logger.info('开始处理新文章', {
        category: LogCategory.ARTICLE,
        data: { 
          url,
          templateId,
          tabId: currentTabId,
          timestamp: new Date().toISOString()
        }
      })
      await processArticle(url, templateId)
    } catch (error) {
      logger.error('处理文章失败', {
        category: LogCategory.ARTICLE,
        data: { 
          error,
          url,
          templateId,
          timestamp: new Date().toISOString()
        }
      })
      throw error
    }
  }

  const handleLocalArticleClick = async (filename: string) => {
    try {
      if (!templateId) {
        throw new Error('请先选择一个模板')
      }

      if (!currentTabId) {
        throw new Error('请在微信公众号编辑器中使用此功能')
      }

      logger.info('开始处理本地文章', {
        category: LogCategory.ARTICLE,
        data: { 
          filename,
          templateId,
          tabId: currentTabId,
          timestamp: new Date().toISOString()
        }
      })

      // 1. 获取本地文章数据
      const response = await sendToBackground<{ filename: string }, ApiResponse<ArticleContent>>({
        name: "get-local-article-by-name",
        body: { filename }
      })

      if (!response.success) {
        const errorResponse = response as ErrorResponse
        throw new Error(errorResponse.error.message || '获取文章失败')
      }
      debugger
      // 2. 使用 articleService 处理渲染流程
      await articleService.processLocalArticle({
        articleData: response.data,
        templateId,
        tabId: currentTabId
      })

      logger.info('本地文章处理完成', {
        category: LogCategory.ARTICLE,
        data: { 
          filename,
          templateId,
          title: response.data.title,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      logger.error('处理本地文章失败', {
        category: LogCategory.ARTICLE,
        data: { 
          错误类型: error instanceof Error ? error.name : typeof error,
          错误信息: error instanceof Error ? error.message : String(error),
          filename,
          templateId,
          timestamp: new Date().toISOString()
        }
      })
      throw error
    }
  }

  return (
    <div className="w-[800px] min-h-[600px] bg-white text-gray-800">
      <div className="flex flex-col h-full">
        {/* 头部导航 */}
        <header className="p-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">文章处理助手</h1>
            <div className="flex items-center space-x-2">
              {currentTabId && (
                <span className="text-sm bg-green-500 px-2 py-1 rounded-full">
                  已连接编辑器
                </span>
              )}
            </div>
          </div>
        </header>

        {/* 主要内容区 */}
        <main className="flex-1 p-6">
          {tabError ? (
            <Alert color="failure" className="mb-4">
              <div className="flex flex-col items-center justify-center gap-4 p-4">
                <p>{tabError}</p>
                <Button color="blue" onClick={getCurrentTab}>
                  刷新插件
                </Button>
              </div>
            </Alert>
          ) : (
            <Tabs>
              <Tabs.Item active icon={HiTemplate} title="模板配置">
                <Card className="mb-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">选择渲染模板</h3>
                      <ArticleTemplateSelect
                        value={templateId}
                        onChange={setTemplateId}
                        disabled={loading}
                      />
                    </div>
                    <div className="pt-4">
                      <ArticleForm
                        loading={loading}
                        error={error}
                        loadingState={loadingState}
                        onSubmit={onSubmit}
                        translateService={translateService}
                        onTranslateServiceChange={changeTranslateService}
                      />
                    </div>
                  </div>
                </Card>
              </Tabs.Item>

              <Tabs.Item icon={HiDocument} title="本地文章">
                <Card>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">已保存的文章</h3>
                      <Button size="sm" color="light">
                        刷新列表
                      </Button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <LocalArticles
                        currentTabId={currentTabId}
                        templateId={templateId}
                        onClick={handleLocalArticleClick}
                      />
                    </div>
                  </div>
                </Card>
              </Tabs.Item>

              <Tabs.Item icon={HiCog} title="设置">
                <Card>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">翻译服务配置</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          翻译服务
                        </label>
                        <select
                          className="w-full rounded-lg border-gray-300"
                          value={translateService}
                          onChange={(e) => changeTranslateService(e.target.value as TranslateServiceType)}
                        >
                          <option value={TranslateServiceType.GOOGLE}>Google 翻译</option>
                          <option value={TranslateServiceType.COZE}>Coze 翻译</option>
                          <option value={TranslateServiceType.CUSTOM}>自定义翻译</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </Card>
              </Tabs.Item>
            </Tabs>
          )}
        </main>

        {/* 底部状态栏 */}
        <footer className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  <span>{typeof loadingState === 'string' ? loadingState : '处理中...'}</span>
                </div>
              ) : (
                '就绪'
              )}
            </span>
            <span className="text-xs text-gray-500">
              {new Date().toLocaleDateString()}
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default IndexPopup

