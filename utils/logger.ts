// 日志级别枚举
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// 日志类别枚举
export enum LogCategory {
  ARTICLE = 'article',
  TRANSLATE = 'translate',
  BACKGROUND = 'background',
  POPUP = 'popup'
}

interface LogOptions {
  category: LogCategory
  data?: any
  timestamp?: number
}

// 日志条目接口
interface LogEntry {
  level: LogLevel
  category: LogCategory
  message: string
  data?: any
  timestamp: number
}

class Logger {
  private static instance: Logger
  private logLevel: LogLevel = LogLevel.INFO
  private logs: LogEntry[] = []
  private readonly maxLogs: number = 1000

  private constructor() {
    // 从 chrome.storage 恢复日志级别
    chrome.storage.local.get(['logLevel'], (result) => {
      if (result.logLevel) {
        this.logLevel = result.logLevel
      }
    })
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  // 设置日志级别
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level
    chrome.storage.local.set({ logLevel: level })
  }

  // 获取日志级别
  public getLogLevel(): LogLevel {
    return this.logLevel
  }

  // 清理日志
  public clearLogs(): void {
    this.logs = []
  }

  // 获取日志
  public getLogs(category?: LogCategory): LogEntry[] {
    return category 
      ? this.logs.filter(log => log.category === category)
      : this.logs
  }

  // 导出日志
  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  // 记录日志
  private log(level: LogLevel, message: string, options: LogOptions): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      level,
      category: options.category,
      message,
      data: options.data,
      timestamp: options.timestamp || Date.now()
    }

    // 添加到日志数组
    this.logs.push(entry)

    // 如果超过最大数量，删除最旧的日志
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // 控制台输出
    const logFn = this.getConsoleMethod(level)
    const prefix = `[${entry.level}][${entry.category}]`
    
    if (entry.data) {
      logFn(prefix, message, entry.data)
    } else {
      logFn(prefix, message)
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel)
    return levels.indexOf(level) >= levels.indexOf(this.logLevel)
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug
      case LogLevel.INFO:
        return console.log
      case LogLevel.WARN:
        return console.warn
      case LogLevel.ERROR:
        return console.error
      default:
        return console.log
    }
  }

  // 公共日志方法
  public debug(message: string, options: LogOptions): void {
    this.log(LogLevel.DEBUG, message, options)
  }

  public info(message: string, options: LogOptions): void {
    this.log(LogLevel.INFO, message, options)
  }

  public warn(message: string, options: LogOptions): void {
    this.log(LogLevel.WARN, message, options)
  }

  public error(message: string, options: LogOptions): void {
    this.log(LogLevel.ERROR, message, options)
  }
}

// 导出单例实例
export const logger = Logger.getInstance() 