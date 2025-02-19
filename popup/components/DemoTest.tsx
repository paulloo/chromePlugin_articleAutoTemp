import { useState } from "react"
import { useDemoMessage } from "../../hooks/useDemoMessage"

export const DemoTest = () => {
  const [testParam, setTestParam] = useState("")
  const { loading, error, data, sendMessage } = useDemoMessage()

  const handleTest = async () => {
    try {
      await sendMessage(testParam || "默认测试参数")
    } catch (error) {
      console.error("测试失败:", error)
    }
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">消息测试</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={testParam}
            onChange={(e) => setTestParam(e.target.value)}
            placeholder="输入测试参数"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleTest}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "测试中..." : "发送测试"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
          错误: {error}
        </div>
      )}

      {data && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">测试结果:</h3>
          <pre className="p-3 bg-gray-100 rounded-lg overflow-auto max-h-60 text-sm">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
} 