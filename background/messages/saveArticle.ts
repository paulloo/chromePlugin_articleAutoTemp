
import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import axios from "axios";
const storage = new Storage()
 
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {

  const json = req.body

  console.log("save body:", json)

  const apiURL = process.env.PLASMO_PUBLIC_ARTICLE_API

  const saveRes =  await axios.post(`${apiURL}/save_data`, {...json});

  console.log('saveRes: ', saveRes)
}

 
export default handler