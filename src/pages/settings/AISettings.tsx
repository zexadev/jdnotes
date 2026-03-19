import { useState } from 'react'
import { Eye, EyeOff, Plus, Trash2, Check } from 'lucide-react'
import { useAIConfig, PROVIDER_PRESETS, OPENAI_COMPATIBLE_PRESETS } from '../../hooks/useSettings'
import type { AIProvider, AISource } from '../../hooks/useSettings'
import { Select } from '../../components/common/Select'
import type { SelectOption } from '../../components/common/Select'

const PROVIDER_OPTIONS: SelectOption<AIProvider>[] = [
  { value: 'openai', label: 'OpenAI 兼容', description: '支持 OpenAI、DeepSeek、智谱、通义、Moonshot 等' },
  { value: 'anthropic', label: 'Anthropic Claude', description: 'Claude 官方 API' },
  { value: 'google', label: 'Google Gemini', description: 'Google AI Studio API' },
  { value: 'ollama', label: 'Ollama 本地', description: '本地运行的 Ollama 服务' },
]

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function AISettings() {
  const { config, addSource, removeSource, updateSource, setActiveSource } = useAIConfig()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  const selected = config.sources.find(s => s.id === (selectedId ?? config.activeSourceId))

  const handleAddSource = () => {
    const preset = PROVIDER_PRESETS['openai']
    const newSource: AISource = {
      id: generateId(),
      name: '新来源',
      provider: 'openai',
      baseUrl: preset.baseUrl,
      apiKey: '',
      model: preset.defaultModel,
    }
    addSource(newSource)
    setSelectedId(newSource.id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          AI 配置
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          管理多个 AI 来源，快速切换不同模型
        </p>
      </div>

      {/* 来源列表 */}
      <div className="space-y-2">
        {config.sources.map((source) => {
          const isActive = source.id === config.activeSourceId
          const isSelected = source.id === (selectedId ?? config.activeSourceId)
          return (
            <div
              key={source.id}
              onClick={() => setSelectedId(source.id)}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all border ${
                isSelected
                  ? 'border-[#5E6AD2] bg-[#5E6AD2]/5 dark:bg-[#5E6AD2]/10'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {/* 激活指示器 */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveSource(source.id)
                }}
                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isActive
                    ? 'border-[#5E6AD2] bg-[#5E6AD2]'
                    : 'border-gray-300 dark:border-gray-600 hover:border-[#5E6AD2]'
                }`}
                title={isActive ? '当前激活' : '点击激活'}
              >
                {isActive && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {source.name}
                  </span>
                  {isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[#5E6AD2]/10 text-[#5E6AD2] rounded-full">
                      使用中
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  {PROVIDER_PRESETS[source.provider]?.name} · {source.model}
                </div>
              </div>

              {/* 删除按钮 */}
              {config.sources.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (selectedId === source.id) setSelectedId(null)
                    removeSource(source.id)
                  }}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                  title="删除来源"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        })}

        {/* 添加来源按钮 */}
        <button
          onClick={handleAddSource}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-[#5E6AD2] hover:text-[#5E6AD2] transition-colors"
        >
          <Plus className="h-4 w-4" />
          添加来源
        </button>
      </div>

      {/* 编辑面板 */}
      {selected && (
        <div className="space-y-5 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            编辑：{selected.name}
          </div>

          {/* 来源名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              来源名称
            </label>
            <input
              type="text"
              value={selected.name}
              onChange={(e) => updateSource(selected.id, { name: e.target.value })}
              placeholder="如 DeepSeek、Claude 等"
              className="w-full px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* 模型平台选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              模型平台
            </label>
            <Select
              value={selected.provider}
              onChange={(provider) => {
                const preset = PROVIDER_PRESETS[provider]
                updateSource(selected.id, {
                  provider,
                  baseUrl: preset.baseUrl,
                  model: preset.defaultModel,
                })
              }}
              options={PROVIDER_OPTIONS}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {PROVIDER_PRESETS[selected.provider].description}
            </p>
          </div>

          {/* OpenAI 兼容服务快速选择 */}
          {selected.provider === 'openai' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                快速选择服务
              </label>
              <div className="flex flex-wrap gap-2">
                {OPENAI_COMPATIBLE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      updateSource(selected.id, {
                        baseUrl: preset.baseUrl,
                        model: preset.model,
                        name: preset.name,
                      })
                    }}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      selected.baseUrl === preset.baseUrl
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
              value={selected.baseUrl}
              onChange={(e) => updateSource(selected.id, { baseUrl: e.target.value })}
              placeholder={PROVIDER_PRESETS[selected.provider].baseUrl}
              className="w-full px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
              {!PROVIDER_PRESETS[selected.provider].apiKeyRequired && (
                <span className="ml-1 text-gray-400 font-normal">（可选）</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={selected.apiKey}
                onChange={(e) => updateSource(selected.id, { apiKey: e.target.value })}
                placeholder={PROVIDER_PRESETS[selected.provider].apiKeyPlaceholder}
                className="w-full px-4 py-2.5 pr-12 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              value={selected.model}
              onChange={(e) => updateSource(selected.id, { model: e.target.value })}
              placeholder={PROVIDER_PRESETS[selected.provider].defaultModel}
              className="w-full px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          更改设置后会立即生效，无需重启应用。点击来源左侧圆圈可切换激活来源。
        </p>
      </div>
    </div>
  )
}
