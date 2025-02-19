import "@plasmohq/messaging/background"
import { init } from "@plasmohq/selector/background"
import { startHub } from "@plasmohq/messaging/pub-sub"

// 初始化选择器
init({
    monitorId: process.env.PLASMO_PUBLIC_ITERO_SELECTOR_MONITOR_ID
})

console.log(`BGSW - Starting Hub`)

// 启动消息中心
startHub()
