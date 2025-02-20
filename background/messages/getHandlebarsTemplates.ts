import type { PlasmoMessaging } from "@plasmohq/messaging"
import { logger, LogCategory } from "../../utils/logger"
import { apiClient } from "../../utils/api"
import { ApiEndpoints } from "../../types/api"
import type { Template, ApiResponse } from "../../types/api"

const handler: PlasmoMessaging.MessageHandler<void, ApiResponse<Template>> = async (req, res) => {
  const requestId = Math.random().toString(36).substring(7)

  try {
    logger.info('开始获取模板列表', {
      category: LogCategory.TEMPLATE,
      data: { 
        requestId,
        timestamp: new Date().toISOString()
      }
    })

    logger.debug('准备发送API请求', {
      category: LogCategory.TEMPLATE,
      data: { 
        requestId,
        endpoint: ApiEndpoints.GET_TEMPLATES,
        timestamp: new Date().toISOString()
      }
    })

    const response = await apiClient.request<Template>({
      method: 'GET',
      url: ApiEndpoints.GET_TEMPLATES
    })

    logger.debug('收到API响应', {
      category: LogCategory.TEMPLATE,
      data: { 
        requestId,
        responseStatus: response.status,
        responseDataExists: !!response.data,
        itemsCount: response.data?.items?.length,
        timestamp: new Date().toISOString()
      }
    })

    if (!response.data?.items) {
      throw new Error('API响应数据格式不正确')
    }

    logger.info('获取模板列表成功', {
      category: LogCategory.TEMPLATE,
      data: { 
        requestId,
        templatesCount: response.data.items.length,
        templates: response.data.items.map(t => t.name),
        timestamp: new Date().toISOString()
      }
    })

    res.send(response)
  } catch (error) {
    logger.error('获取模板列表失败', {
      category: LogCategory.TEMPLATE,
      data: { 
        requestId,
        error,
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    })

    if ((error as any).status === 'error') {
      res.send(error)
      return
    }

    res.send({
      status: 'error',
      message: error instanceof Error ? error.message : '获取模板列表失败',
      data: {
        items: [],
        pagination: null
      },
      timestamp: new Date().toISOString()
    })
  }
}

export default handler 