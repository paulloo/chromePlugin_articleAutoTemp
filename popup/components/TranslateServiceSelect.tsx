import { useCallback } from "react"
import { TranslateServiceType } from "../../utils/translate/types"

interface Props {
  value: TranslateServiceType
  onChange: (value: TranslateServiceType) => void
  disabled?: boolean
}

export const TranslateServiceSelect = ({ value, onChange, disabled }: Props) => {
  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value as TranslateServiceType)
  }, [onChange])

  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium text-gray-700">
        翻译服务
      </label>
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
      >
        <option value={TranslateServiceType.GOOGLE}>谷歌翻译</option>
        <option value={TranslateServiceType.COZE}>Coze 翻译</option>
        <option value={TranslateServiceType.CUSTOM}>自定义翻译</option>
      </select>
    </div>
  )
} 