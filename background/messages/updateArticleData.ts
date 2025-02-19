import type { PlasmoMessaging } from "@plasmohq/messaging"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const { message, success, filename, status, error, details } = req.body;
    
    console.log('[updateArticleData] 发送更新消息:', {
      type: "ARTICLE_DATA_UPDATE",
      data: {
        message,
        success,
        filename,
        status,
        error,
        details
      }
    });

    // 构造消息对象
    const messageData = {
      type: "ARTICLE_DATA_UPDATE",
      data: {
        message,
        success,
        filename,
        status,
        error,
        details
      }
    };

    // 广播更新消息给所有监听者
    chrome.runtime.sendMessage(messageData);

    res.send({
      success: true
    });
  } catch (error) {
    console.error("[updateArticleData] 更新文章数据失败:", error);
    res.send({
      success: false,
      error: error.message
    });
  }
}

export default handler; 