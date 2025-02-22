import axios from "axios"

import { sendToBackground, type PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

const storage = new Storage()

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  // console.log("cozeToken: ", process.env.PLASMO_PUBLIC_EXTENSION_ID, process.env.PLASMO_PUBLIC_COZE_SECRET_API, process.env.PLASMO_PUBLIC_COZE_BOT_ID, process.env.PLASMO_PUBLIC_COZE_USER_ID)

  const apiURL = "http://127.0.0.1:5508"

  try {
    const response = await axios.post(`${apiURL}/fetch_content`, req.body)
    const data = response.data

    res.send({
      message: data
    })
  } catch (error) {
    console.error("Fetching data failed", error)
    // 处理错误情况
  }

  // res.send({
  //   message
  // })
}

export default handler
