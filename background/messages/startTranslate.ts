import axios from "axios"

import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

const storage = new Storage()

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {

    let timerCount = 1
    let messageTimer = null
  const cozeHost = process.env.PLASMO_PUBLIC_COZE_API
  const cozeToken = process.env.PLASMO_PUBLIC_COZE_SECRET_API
  const botId = process.env.PLASMO_PUBLIC_COZE_BOT_ID
  const userId = process.env.PLASMO_PUBLIC_COZE_USER_ID

  console.log("startTranslate req.body: ", req.body)
  const { text } = req.body

  

  const apiURL = `${cozeHost}/v3/chat`
  const params = {
    bot_id: botId,
    user_id: userId,
    additional_messages: [
      {
        role: "user",
        content: typeof text === "object" ? JSON.stringify(text) : text,
        content_type: "text"
      }
    ],
    stream: false
  }

  console.log("start translate:", text)

  chrome.action.setBadgeText({ text: `start` })

  const response = await axios({
    url: apiURL,
    method: 'POST',
    data: params,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cozeToken}`,
    }
});

const a = 0.01
const L = text.length
const b = 1

timerCount = 1

const durationAfter = (a * L + b) * 1000
console.log('current Duration: ', durationAfter * timerCount)
let messages = []

async function getMessageList(conversation_id, chat_id) {

    console.log('bot complete...')
    const params = {
        conversation_id,
        chat_id
    }
    const response = await axios({
        url: `${cozeHost}/v3/chat/message/list`,
        params,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cozeToken}`,
        }
    });

    return response.data?.data
}

async function getMessageByConversationId(conversation_id, chat_id, durationAfter) {

    console.log('bot in progress...')
    const params = {
        conversation_id,
        chat_id
    }
    const response = await axios({
        url: `${cozeHost}/v3/chat/retrieve`,
        params,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cozeToken}`,
        }
    });

   return response.data
}
async function processConversationResponse(_response: any) {
    const conversationResponse = await getMessageByConversationId(_response.data.conversation_id, _response.data.id, durationAfter)

    const errorStatus = ['created', 'failed', 'requires_action']
    const loopStatus = ['in_progress']
    const finishStatus = ['completed']
    if(errorStatus.includes(conversationResponse.data.status)) {
        return []
    }

    console.log("duration: ", durationAfter * timerCount)
        
    chrome.action.setBadgeText({ text: `t-:${timerCount}` })
    if (loopStatus.includes(conversationResponse.data.status)) {
        await new Promise(resolve => {
            messageTimer = setTimeout(resolve, durationAfter * timerCount)
        })
        timerCount += 1
        clearTimeout(messageTimer)
        return processConversationResponse(_response)
    }

    if (finishStatus.includes(conversationResponse.data.status)) {
        return await getMessageList(_response.data.conversation_id, _response.data.id)
    }

    return []
}

messages = await processConversationResponse(response.data)

const answer = messages.find(item => item.type === "answer") || {}
// if (answer) {
//     const { output } = JSON.parse(answer.content)
//     return output
// }
console.log('translate response111: ', answer)


chrome.action.setBadgeText({ text: 'done' })

const result = answer?.content? answer.content: text

  res.send({
    message: result
  })
}

export default handler
