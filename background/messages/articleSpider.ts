import axios from "axios"

import { sendToBackground, type PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import type { ArticleData } from "~/types"

const storage = new Storage()

// 定义状态和错误类型
enum ProcessStatus {
  INIT = 'init',
  SCRAPING = 'scraping',
  WAITING_FILE = 'waiting_file',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  ERROR = 'error'
}

interface ProcessError extends Error {
  code?: string;
  details?: any;
}

// 添加超时控制的 fetch 函数
async function fetchWithTimeout(url: string, options: any = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await axios({
      ...options,
      url,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
}

// 改进的重试逻辑
async function fetchWithRetry(url: string, retries = 5, initialDelay = 2000) {
  let delay = initialDelay;
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`尝试获取文件 (${i + 1}/${retries})...`);
      const response = await fetchWithTimeout(url, {}, 5000);
      if (response.status === 200 && response.data) {
        return response.data;
      }
      throw new Error(`响应状态码: ${response.status}`);
    } catch (error) {
      lastError = error;
      console.log(`获取失败: ${error.message}`);
      if (i === retries - 1) break;
      
      delay = Math.min(delay * 1.5, 10000); // 最大延迟10秒
      console.log(`等待 ${delay/1000} 秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`多次重试失败: ${lastError?.message}`);
}

// 改进的文件检查逻辑
async function checkFileExists(url: string, maxAttempts = 10, checkInterval = 1000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetchWithTimeout(url, { method: 'HEAD' }, 3000);
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('文件不存在，继续等待...');
      } else {
        console.log(`检查文件出错: ${error.message}`);
      }
      
      if (i === maxAttempts - 1) {
        console.log('文件检查超时');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  return false;
}

// 改进数据获取函数
async function fetchArticleData(apiURL: string, filename: string, maxRetries = 3): Promise<any> {
  const fileUrl = `${apiURL}/get_data/${filename}`;
  console.log(`开始获取文件数据: ${fileUrl}`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetchWithTimeout(fileUrl, {}, 5000);
      console.log('获取到文件数据:', response.data);
      
      // 检查数据结构
      const data = response.data;
      if (!data) {
        throw new Error('返回数据为空');
      }

      // 预处理数据
      return {
        title: data.title || '',
        profile: data.profile || '',
        steps: Array.isArray(data.steps) ? data.steps.map(step => ({
          title: step.title || step.step_title || '', // 支持两种可能的标题字段
          step_items: Array.isArray(step.step_items) ? step.step_items.map(item => ({
            content: item.content || item.text || '', // 支持两种可能的内容字段
            children: Array.isArray(item.children) ? item.children : []
          })) : []
        })) : []
      };
    } catch (error) {
      console.log(`第 ${i + 1} 次获取失败: ${error.message}`);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('无法获取文件数据');
}

// 数据验证函数
function validateArticleData(data: any): data is ArticleData {
  if (!data || typeof data !== 'object') {
    console.error('数据不是对象类型');
    return false;
  }
  if (typeof data.title !== 'string') {
    console.error('标题不是字符串类型');
    return false;
  }
  if (typeof data.profile !== 'string') {
    console.error('简介不是字符串类型');
    return false;
  }
  if (!Array.isArray(data.steps)) {
    console.error('步骤不是数组类型');
    return false;
  }

  return data.steps.every((step, stepIndex) => {
    if (typeof step !== 'object') {
      console.error(`步骤 ${stepIndex + 1} 不是对象类型`);
      return false;
    }
    if (typeof step.title !== 'string') {
      console.error(`步骤 ${stepIndex + 1} 标题不是字符串类型`);
      return false;
    }
    if (!Array.isArray(step.step_items)) {
      console.error(`步骤 ${stepIndex + 1} 的 step_items 不是数组类型`);
      return false;
    }

    return step.step_items.every((item, itemIndex) => {
      if (typeof item !== 'object') {
        console.error(`步骤 ${stepIndex + 1} 的第 ${itemIndex + 1} 个项目不是对象类型`);
        return false;
      }
      if (typeof item.content !== 'string') {
        console.error(`步骤 ${stepIndex + 1} 的第 ${itemIndex + 1} 个项目内容不是字符串类型`);
        return false;
      }
      if (!Array.isArray(item.children)) {
        console.error(`步骤 ${stepIndex + 1} 的第 ${itemIndex + 1} 个项目的 children 不是数组类型`);
        return false;
      }
      return true;
    });
  });
}

// 添加统一的数据接口
interface ArticleResponse {
  success: boolean;
  type: string;
  data?: {
    message: ArticleData;
    filename: string;
    status: ProcessStatus;
    details: {
      textsCount: number;
      timestamp: string;
    };
  };
  error?: string;
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    console.log('[爬虫] 收到请求:', req.body)
    const { url } = req.body

    // 1. 检查API配置
    const apiURL = process.env.PLASMO_PUBLIC_ARTICLE_API
    if (!apiURL) {
      return res.send({
        success: false,
        error: 'API未配置'
      })
    }

    // 2. 发送爬取请求
    console.log('[爬虫] 发送爬取请求:', url)
    const scrapeResponse = await axios.post(`${apiURL}/scrape`, { ...url })
    
    if (!scrapeResponse.data.success) {
      return res.send({
        success: false,
        error: scrapeResponse.data.error || '爬取失败'
      })
    }

    const filename = scrapeResponse.data.filename
    console.log('[爬虫] 爬取成功, 文件名:', filename)

    // 3. 获取文件数据
    console.log('[爬虫] 等待文件生成...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('[爬虫] 获取文件数据')
    const fileResponse = await axios.get(`${apiURL}/get_data/${filename}`)
    const fileData = fileResponse.data
    
    console.log('[爬虫] 原始数据:', fileData)

    // 4. 格式化数据
    const formattedData = {
      title: fileData.title || '',
      profile: fileData.profile || '',
      steps: fileData.steps?.map(step => ({
        title: step.title || '',
        step_items: step.items?.map(item => ({
          content: item.content || '',
          children: []
        })) || []
      })) || []
    }

    console.log('[爬虫] 格式化后的数据:', formattedData)

    // 5. 返回响应
    console.log('[爬虫] 处理完成，返回数据')
    return res.send({
      success: true,
      data: formattedData
    })

  } catch (error) {
    console.error('[爬虫] 处理失败:', error)
    return res.send({
      success: false,
      error: error.message || '处理失败'
    })
  }
}

export default handler
