import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { DemoData } from "../../types/demo"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const requestId = Math.random().toString(36).substring(7)
  console.log('[Demo] 收到请求:', {
    requestId,
    message: req.body,
    时间戳: new Date().toISOString()
  })
  
  const { param } = req.body
  console.log('[Demo] 解析参数:', {
    requestId,
    param,
    时间戳: new Date().toISOString()
  })

  // 模拟一些数据处理
  const demoData: DemoData = {
    id: 1,
    title: `测试标题 - ${param || '默认'}`,
    content: "测试内容",
    items: [
      { id: 1, name: "项目1" },
      { id: 2, name: "项目2" }
    ]
  }

  // 构造响应
  const response = {
    success: true,
    data: demoData
  }

  console.log('[Demo] 发送响应:', {
    requestId,
    完整数据: response,
    序列化数据: JSON.stringify(response),
    时间戳: new Date().toISOString()
  })

  res.send(response)
}

export default handler 