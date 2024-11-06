import axios from "axios"
import dayjs from "dayjs"
import { useEffect, useRef, useState } from "react"

import {
  sendToBackground,
  sendToBackgroundViaRelay,
  sendToContentScript
} from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import { getPort } from '@plasmohq/messaging/port'

import "../styles/main.css"

import clsx from "clsx"
import generalSnd from "data-base64:~assets/sound/general.wav"
import { isEmpty } from "radash"

import defaultIcon from "~assets/icon.png"
import falloutBg from "~assets/img/bg_fallout_2.jpg"
import pokemonBg from "~assets/img/bg_game.jpg"
import londonBg from "~assets/img/bg_london.jpg"
import r2d2Bg from "~assets/img/bg_r2d2.jpg"
import simpleBg from "~assets/img/bg_simple.jpg"
import vaderBg from "~assets/img/bg_vader.jpg"
import simpleDoneBg from "~assets/img/BG01.jpg"
import londonDoneBg from "~assets/img/BG03.jpg"
import pokemonDoneBg from "~assets/img/BG04.jpg"
import vaderDoneBg from "~assets/img/BG05.jpg"
import r2d2DoneBg from "~assets/img/BG06.jpg"
import falloutDoneBg from "~assets/img/fall.jpg"
import londonIcon from "~assets/img/icon_bus.svg"
import falloutIcon from "~assets/img/icon_cowboy_hat.svg"
import pokemonIcon from "~assets/img/icon_game.svg"
import vaderIcon from "~assets/img/icon_helmet.svg"
import r2d2Icon from "~assets/img/icon_r2d2.svg"
import simpleIcon from "~assets/img/icon_stopwatch.svg"
import { unescape } from "querystring"
import LocalArticles from "./LocalArticles"

const projects = [
  {
    id: 1,
    doneBg: simpleDoneBg,
    className: "simple",
    color: "#013d99",
    snd: "simple",
    bg: simpleBg,
    icon: simpleIcon,
    title: "Simple",
    on: true,
    theme: "theme-light"
  },
  {
    id: 2,
    doneBg: falloutDoneBg,
    className: "fallout",
    color: "#0e980c",
    snd: "fallout",
    bg: falloutBg,
    icon: falloutIcon,
    title: "Fallout",
    on: false,
    theme: "theme-evergreen"
  },
  {
    id: 3,
    doneBg: londonDoneBg,
    className: "london",
    color: "#ba0001",
    snd: "london",
    bg: londonBg,
    icon: londonIcon,
    title: "London",
    on: false,
    theme: "theme-light"
  },
  {
    id: 4,
    doneBg: pokemonDoneBg,
    className: "pokemon",
    color: "#990001",
    snd: "pokemon",
    bg: pokemonBg,
    icon: pokemonIcon,
    title: "Pokemon",
    on: false,
    theme: "theme-solar"
  },
  {
    id: 5,
    doneBg: vaderDoneBg,
    className: "vader",
    color: "#00869a",
    snd: "vader",
    bg: vaderBg,
    icon: vaderIcon,
    title: "Vader",
    on: false,
    theme: "theme-dark"
  },
  {
    id: 6,
    doneBg: r2d2DoneBg,
    className: "r2d2",
    color: "#1f0099",
    snd: "r2d2",
    bg: r2d2Bg,
    icon: r2d2Icon,
    title: "R2D2",
    on: false,
    theme: "theme-dark"
  }
]

const storage = new Storage({
  area: "local"
})

const capturePort = getPort('capture')

function IndexPopup() {
  const timerRef = useRef(null)
  const urlRef = useRef(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [articleData, setArticleData] = useState({})

  const [localArticles, setLocalArticles] = useState([])

  const [loading, setLoading] = useState(false)
  const [localData, setLocalData] = useState(false)

  const defaultTheme = projects[0]

  const [currentTheme, setCurrentTheme] = useStorage(
    "currentTheme",
    defaultTheme
  )

  const [localArticleList, setLocalArticleList] = useStorage({
    key: "articleList",
    instance: new Storage({
      area: "local"
    })
  })

  // 倒计时状态
  const [couting, setCouting] = useState(false)

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))
  async function setArticleToMp(message) {
    const tabIds = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabIds[0].id
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: "setArticleToRichText", data: message }, (response) => {
        if (chrome.runtime.lastError || !response) {
          reject(`setArticleToRichText error:${JSON.stringify(chrome.runtime.lastError)}`)
        } else {
          resolve(response)
        }
      })
    })
  }

  useEffect(() => {
    function listener(event) {
      setArticleToMp(event.data)
    }
    window.addEventListener("message", listener)

    return () => {
      window.removeEventListener("message", listener)
    }
  }, [setArticleToMp])

  useEffect(() => {

    getLocalList()
  }, [])

  async function getLocalList() {
    

    const { records } = await sendToBackground({ 
      name: "get-local-articles", 
      body: {
      },
      extensionId: process.env.PLASMO_PUBLIC_EXTENSION_ID 
    })

    setLocalArticles(records.files)
  }

  async function renderTempByData(data) {
    // const tempFile = 'templates/puppy.hbs'
    const tempFile = 'templates/temp2.hbs'

    const templateUrl = chrome.runtime.getURL(tempFile)
    const templateSource = await fetch(templateUrl).then(response => response.text())

    // 渲染模板并插入到 DOM 中
    console.log("message: ", data);
    const json = {
      ...data,
      guide: '点击上方蓝字关注我们',
      history: [{
          title: '试试这个三分钟妙招，养狗新手秒变驯犬高手！',
          url: 'http://mp.weixin.qq.com/s?__biz=MzAwODI3OTQyMA==&amp;mid=2247489061&amp;idx=1&amp;sn=db0a547256f1f50e4b64f976840f7c07&amp;chksm=9b701236ac079b2059613eeff6d63a55c22f881a02f695c02444ac95ac201a8430680e285c59&amp;scene=21#wechat_redirect'
      }, {
          title: '喂养小狗，不仅仅是选狗粮这么简单',
          url: 'http://mp.weixin.qq.com/s?__biz=MzAwODI3OTQyMA==&amp;mid=2247484435&amp;idx=1&amp;sn=4b9e12061a1645a4f7599e78f372213f&amp;chksm=9b700000ac0789161b65aada7df60a7a7125f75f2762636bc60b26c95c30cc77f49a313f2e3d&amp;scene=21#wechat_redirect'
      }, {
          title: '炎炎夏日，狗友提醒：警惕狗狗中暑！',
          url: 'http://mp.weixin.qq.com/s?__biz=MzAwODI3OTQyMA==&amp;mid=2247484414&amp;idx=1&amp;sn=e35c36c8683b8d7dcc31373209b7e73b&amp;chksm=9b7007edac078efbdc9d3369b02f1a70fc03ef49e677e9b63696717cc1b2e1323618cbd07b9a&amp;scene=21#wechat_redirect'
      }]
    }
    iframeRef.current?.contentWindow.postMessage({
      temp: templateSource,
      data: json
    }, "*")


    await sendToBackground({
      name: "saveArticle",
      body: json,
      extensionId: process.env.PLASMO_PUBLIC_EXTENSION_ID
    })
  }


  function stripHTMLTags(htmlString, tagNames?: string[]) {

    if (!htmlString) {
        return ''
    }
    htmlString = filterReference(htmlString)

    var regex;
    if (tagNames && Array.isArray(tagNames)) {
        // 创建匹配指定标签的正则表达式
        var regex = new RegExp(`<\\/?(?:${tagNames.map(tag => tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})[^>]*>`, 'gi');
    } else {
        // 匹配所有标签的正则表达式 
        regex = /<\/?[^>]+(>|$)/g;
    }
    return htmlString.replace(regex, "");
  }

  function filterReference(htmlString) {
      if (!htmlString) {
          return ''
      }

      // // 创建一个 DOMParser 实例 
      // const parser = new DOMParser(); 
      // // 将 HTML 字符串解析成 DOM 对象 
      // const doc = parser.parseFromString(htmlString, 'text/html'); 
      // // 获取所有 class 为 'reference' 的 sup 标签 
      // const sups = doc.querySelectorAll('sup.reference'); 
      // // 遍历并移除找到的 sup 标签 
      // sups.forEach(sup => sup.parentNode.removeChild(sup)); 
      // // 将修改后的 DOM 对象转换回 HTML 字符串 
      // const cleanedHtmlString = doc.documentElement.outerHTML;

      // 定义正则表达式来匹配 class="reference" 的 <sup> 标签及其内容 
      const pattern = /<sup[^>]*>[\s\S]*?<\/sup>/g;
      // 使用 replace 方法来删除匹配的内容 
      const cleanedHtmlString = htmlString.replace(pattern, '');

      // 过滤 class 是reference的 sup 标签
      return cleanedHtmlString

  }


  async function cozeBotApi(str) {

    if(!str) {
        return str
    }
    try {
      const { message } = await sendToBackground({ 
        name: "startTranslate", 
        body: {
          text: str
        },
        extensionId: process.env.PLASMO_PUBLIC_EXTENSION_ID 
      })
      console.log('startTranslate back: ', message)
      return message
    } catch(err) {
        console.error(err)
        return str
    }
  }


  async function optimizeData(data, translate = false) {

    if(!translate) {
        return data
    }

    try {
        data.title = await cozeBotApi(data.title);
        data.profile = await cozeBotApi(data.profile);

        for (let i = 0; i < data.steps.length; i++) {
            const step = data.steps[i];

            // Fetch step data
            const _stepTitle = await cozeBotApi(step.title); // Assuming step has a title property

            for (let j = 0; j < step.step_items.length; j++) {
                const stepItem = step.step_items[j];

                // Fetch content data
                const _content = await cozeBotApi(stepItem.content);

                for (let k = 0; k < stepItem.children.length; k++) {
                    const childrenItem = stepItem.children[k];

                    // Fetch children item data
                    const _childrenItem = await cozeBotApi(childrenItem);

                    stepItem.children[k] = _childrenItem;
                }

                step.step_items[j].content = _content;
            }

            data.steps[i].title = _stepTitle;
        }

        console.log("all data: ", data);

        return data;
    } catch (error) {
        console.error("Error optimizing data: ", error);
        return data;
    }
}


  async function handleFullPage() {

    let data = {}
    try {

      const url = urlRef.current.value
      if(!url && !localData) {
        console.log('请输入网址')
        return
      }

      if(!localData) {
        setLoading(true)
        const { message } = await sendToBackground({
          name: "articleSpider",
          body: {
            url,
            rules: {
                title: "h1#section_0 > a",
                profile: "div.mf-section-0 > p",  
                steps: {
                    step_xpath: "div.section.steps",
                    step_title_xpath: "div.headline_info > h3 > span.mw-headline",
                    step_item_xpath: "li",
                    step_item_img_xpath: "div.content-spacer > img",
                    step_item_content_xpath: "div.step",
                    step_item_content_children: "li"
                }
            },
            filters: [
                "sup"
            ]
          },
          extensionId: process.env.PLASMO_PUBLIC_EXTENSION_ID // find this in chrome's extension manager
          // extensionId: 'pljhffcodclmdedjkpdjedfohelamjka'
        })

        const translate = true
        const afterTransMessage = await optimizeData(message, translate);

        console.log("afterTransMessage: ", afterTransMessage)

        data = JSON.parse(stripHTMLTags(JSON.stringify(afterTransMessage)))
        // data = message
      } else {
        setLoading(true)
        const calm_down_when_firework_url = chrome.runtime.getURL('templates/articles/Prevent-Diseases-in-Chickens.json')
  
        const calmDownWhenFireWork = await fetch(calm_down_when_firework_url).then(response => response.text())
        console.log("calm_down_when_firework: ", JSON.parse(calmDownWhenFireWork))
  
        data = JSON.parse(stripHTMLTags(calmDownWhenFireWork))
        // data = JSON.parse(calmDownWhenFireWork)
      }

      setLoading(false)

      console.log('data; ', data)
      renderTempByData(data)
      // setArticleData(message)
    } catch(err) {
      console.error(err)
      setLoading(false)
      renderTempByData(data)
    }

  }

 function handleCheckLocalData(e) {
  console.log(e.target.checked)
  setLocalData(e.target.checked)
 }

async function getLocalDataByName(name) {
  

  const { json } = await sendToBackground({
    name: "get-local-article-by-name",
    body: {
      filename: name,
      
    },
    extensionId: process.env.PLASMO_PUBLIC_EXTENSION_ID // find this in chrome's extension manager
    // extensionId: 'pljhffcodclmdedjkpdjedfohelamjka'
  })

  console.log('localData: ', json)

  renderTempByData(json)
}

async function deleteLocalDataByName(name) {

  const { json } = await sendToBackground({
    name: "delete-local-article-by-name",
    body: {
      filename: name,
      
    },
    extensionId: process.env.PLASMO_PUBLIC_EXTENSION_ID // find this in chrome's extension manager
    // extensionId: 'pljhffcodclmdedjkpdjedfohelamjka'
  })

  console.log('localData: ', json)

  getLocalList()

}


  return (
    <div
      className={clsx(
        "w-96 bg-no-repeat bg-center",
        currentTheme.theme || "theme-light"
      )}>
      <section id="main" className="flex h-full flex-col justify-between px-4 py-4">
        {/* <div className="border-b-2 p-4 dark:border-gray-800">
          <h1 className="text-center text-xl font-semibold leading-6">
            倒计时
          </h1>
        </div> */}


        <div className="flex items-center">
            <input id="checked-checkbox" type="checkbox" checked={localData} value="" onChange={(e) => handleCheckLocalData(e)} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
            <label htmlFor="checked-checkbox" className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300">使用本地数据</label>
        </div>  
        <form className="flex items-center">   
            <label htmlFor="voice-search" className="sr-only">Search</label>
            <div className="relative w-full">
                <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 21 21">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.15 5.6h.01m3.337 1.913h.01m-6.979 0h.01M5.541 11h.01M15 15h2.706a1.957 1.957 0 0 0 1.883-1.325A9 9 0 1 0 2.043 11.89 9.1 9.1 0 0 0 7.2 19.1a8.62 8.62 0 0 0 3.769.9A2.013 2.013 0 0 0 13 18v-.857A2.034 2.034 0 0 1 15 15Z"/>
                    </svg>
                </div>
                <input type="text" ref={urlRef} id="voice-search" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" placeholder="http://xxxxx.com/xxx" required />
                {/* <button type="button" className="absolute inset-y-0 end-0 flex items-center pe-3">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 20">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7v3a5.006 5.006 0 0 1-5 5H6a5.006 5.006 0 0 1-5-5V7m7 9v3m-3 0h6M7 1h2a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3Z"/>
                    </svg>
                </button> */}
            </div>

            
            {
              !loading? <button type="button" onClick={() => handleFullPage()} className="w-[80px] text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 inline-flex items-center">
                生成
                </button>:
              <button disabled type="button" className="w-[80px] text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 inline-flex items-center">
                <svg aria-hidden="true" role="status" className="inline w-4 h-4 me-3 text-white animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB"/>
                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor"/>
                </svg>
                加载中...
                </button>
            }
            

            
        </form>
       

       <LocalArticles list={localArticles} onClick={(item) => getLocalDataByName(item)} onDelete={(item) => deleteLocalDataByName(item)} />

        
          
      </section>
      <iframe src="sandboxes/mpWixin.html" ref={iframeRef} style={{ display: "none" }} />
    </div>
  )
}

export default IndexPopup
