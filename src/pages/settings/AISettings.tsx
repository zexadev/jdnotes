import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useSettings, PROVIDER_PRESETS, OPENAI_COMPATIBLE_PRESETS } from '../../hooks/useSettings'
import type { AIProvider } from '../../hooks/useSettings'
import { Select } from '../../components/common/Select'
import type { SelectOption } from '../../components/common/Select'

// 平台选项定义
const PROVIDER_OPTIONS: SelectOption<AIProvider>[] = [
  { value: 'openai', label: 'OpenAI 兼容', description: '支持 OpenAI、DeepSeek、智谱、通义、Moonshot 等' },
  { value: 'anthropic', label: 'Anthropic Claude', description: 'Claude 官方 API' },
  { value: 'google', label: 'Google Gemini', description: 'Google AI Studio API' },
  { value: 'ollama', label: 'Ollama 本地', description: '本地运行的 Ollama 服务' },
]

export function AISettings() {
  const { settings, updateSetting } = useSettings()
  const [showApiKey, setShowApiKey] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          AI 配置
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          配置 AI 模型的连接参数和认证信息
        </p>
      </div>

      <div className="space-y-5">
        {/* 模型平台选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            模型平台
          </label>
          <Select
            value={settings.aiProvider}
            onChange={(provider) => {
              const preset = PROVIDER_PRESETS[provider]
              updateSetting('aiProvider', provider)
              updateSetting('aiBaseUrl', preset.baseUrl)
              updateSetting('aiModel', preset.defaultModel)
            }}
            options={PROVIDER_OPTIONS}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {PROVIDER_PRESETS[settings.aiProvider].description}
          </p>
        </div>

        {/* OpenAI 兼容服务快速选择 */}
        {settings.aiProvider === 'openai' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              快速选择服务
            </label>
            <div className="flex flex-wrap gap-2">
              {OPENAI_COMPATIBLE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    updateSetting('aiBaseUrl', preset.baseUrl)
                    updateSetting('aiModel', preset.model)
                  }}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    settings.aiBaseUrl === preset.baseUrl
                      ? 'bg-[#5E6AD2] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* API 基础 URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API 基础 URL
          </label>
          <input
            type="text"
            value={settings.aiBaseUrl}
            onChange={(e) => updateSetting('aiBaseUrl', e.target.value)}
            placeholder={PROVIDER_PRESETS[settings.aiProvider].baseUrl}
            className="w-full px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key
            {!PROVIDER_PRESETS[settings.aiProvider].apiKeyRequired && (
              <span className="ml-1 text-gray-400 font-normal">（可选）</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={settings.aiApiKey}
              onChange={(e) => updateSetting('aiApiKey', e.target.value)}
              placeholder={PROVIDER_PRESETS[settings.aiProvider].apiKeyPlaceholder}
              className="w-full px-4 py-2.5 pr-12 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* 模型名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            模型名称
          </label>
          <input
            type="text"
            value={settings.aiModel}
            onChange={(e) => updateSetting('aiModel', e.target.value)}
            placeholder={PROVIDER_PRESETS[settings.aiProvider].defaultModel}
            className="w-full px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>

      {/* 提示信息 */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>提示：</strong>更改设置后会立即生效，无需重启应用。
        </p>
      </div>
    </div>
  )
}
