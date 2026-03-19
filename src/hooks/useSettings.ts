import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

// AI 提供商类型
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'ollama'

// AI 来源
export interface AISource {
  id: string
  name: string
  provider: AIProvider
  baseUrl: string
  apiKey: string
  model: string
}

// AI 配置（多来源）
export interface AIConfig {
  sources: AISource[]
  activeSourceId: string
}

// 兼容旧接口：扁平化的当前激活来源设置
export interface Settings {
  aiProvider: AIProvider
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
}

// 提供商预设配置
export interface ProviderPreset {
  name: string
  baseUrl: string
  defaultModel: string
  apiKeyPlaceholder: string
  apiKeyRequired: boolean
  description: string
}

// 提供商预设配置列表
export const PROVIDER_PRESETS: Record<AIProvider, ProviderPreset> = {
  openai: {
    name: 'OpenAI 兼容',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    apiKeyPlaceholder: 'sk-...',
    apiKeyRequired: true,
    description: '支持 OpenAI、DeepSeek、智谱AI、通义千问、Moonshot 等兼容 OpenAI API 的服务',
  },
  anthropic: {
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyRequired: true,
    description: 'Anthropic 官方 Claude API',
  },
  google: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.0-flash',
    apiKeyPlaceholder: 'AI...',
    apiKeyRequired: true,
    description: 'Google AI Studio Gemini API',
  },
  ollama: {
    name: 'Ollama 本地',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    apiKeyPlaceholder: '可选',
    apiKeyRequired: false,
    description: '本地运行的 Ollama 服务',
  },
}

// 常用 OpenAI 兼容服务预设
export const OPENAI_COMPATIBLE_PRESETS = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '智谱AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
]

const defaultSettings: Settings = {
  aiProvider: 'openai',
  aiBaseUrl: 'https://api.deepseek.com/v1',
  aiApiKey: '',
  aiModel: 'deepseek-chat',
}

// 缓存
let cachedConfig: AIConfig | null = null
let isLoading = false
let loadPromise: Promise<AIConfig> | null = null

// 来源变更监听器
type ConfigChangeListener = (config: AIConfig) => void
const listeners: Set<ConfigChangeListener> = new Set()

function notifyListeners(config: AIConfig) {
  listeners.forEach(fn => fn(config))
}

// 从后端加载配置
async function loadConfigFromBackend(): Promise<AIConfig> {
  if (cachedConfig) return cachedConfig
  if (isLoading && loadPromise) return loadPromise

  isLoading = true
  loadPromise = (async () => {
    try {
      const result = await invoke<{
        sources: Array<{
          id: string
          name: string
          provider: string
          baseUrl: string
          apiKey: string
          model: string
        }>
        activeSourceId: string
      }>('get_ai_config')

      const validProviders: AIProvider[] = ['openai', 'anthropic', 'google', 'ollama']

      cachedConfig = {
        sources: result.sources.map(s => ({
          ...s,
          provider: validProviders.includes(s.provider as AIProvider)
            ? (s.provider as AIProvider)
            : 'openai',
        })),
        activeSourceId: result.activeSourceId,
      }
      return cachedConfig
    } catch (e) {
      console.error('Failed to load AI config:', e)
      cachedConfig = {
        sources: [{
          id: 'default',
          name: 'DeepSeek',
          provider: 'openai',
          baseUrl: defaultSettings.aiBaseUrl,
          apiKey: '',
          model: defaultSettings.aiModel,
        }],
        activeSourceId: 'default',
      }
      return cachedConfig
    } finally {
      isLoading = false
    }
  })()

  return loadPromise
}

// 保存配置到后端
async function saveConfigToBackend(config: AIConfig): Promise<void> {
  try {
    await invoke('save_ai_config', {
      sources: config.sources,
      activeSourceId: config.activeSourceId,
    })
    cachedConfig = config
    notifyListeners(config)
  } catch (e) {
    console.error('Failed to save AI config:', e)
    throw e
  }
}

// 从 AIConfig 中提取当前激活来源的扁平化 Settings
function configToSettings(config: AIConfig): Settings {
  const active = config.sources.find(s => s.id === config.activeSourceId)
  if (active) {
    return {
      aiProvider: active.provider,
      aiBaseUrl: active.baseUrl,
      aiApiKey: active.apiKey,
      aiModel: active.model,
    }
  }
  return defaultSettings
}

// ============= 多来源管理 Hook =============

export function useAIConfig() {
  const [config, setConfigState] = useState<AIConfig>(
    cachedConfig || { sources: [], activeSourceId: '' }
  )
  const [isInitialized, setIsInitialized] = useState(!!cachedConfig)

  useEffect(() => {
    if (!isInitialized) {
      loadConfigFromBackend().then((loaded) => {
        setConfigState(loaded)
        setIsInitialized(true)
      })
    }
  }, [isInitialized])

  // 监听外部变更（如 Chat 侧边栏切换来源）
  useEffect(() => {
    const handler = (newConfig: AIConfig) => {
      setConfigState(newConfig)
    }
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])

  const saveConfig = useCallback(async (newConfig: AIConfig) => {
    setConfigState(newConfig)
    await saveConfigToBackend(newConfig)
  }, [])

  const addSource = useCallback(async (source: AISource) => {
    const newConfig = {
      ...config,
      sources: [...config.sources, source],
    }
    await saveConfig(newConfig)
  }, [config, saveConfig])

  const removeSource = useCallback(async (id: string) => {
    if (config.sources.length <= 1) return
    const newSources = config.sources.filter(s => s.id !== id)
    const newActiveId = config.activeSourceId === id
      ? newSources[0].id
      : config.activeSourceId
    await saveConfig({ sources: newSources, activeSourceId: newActiveId })
  }, [config, saveConfig])

  const updateSource = useCallback(async (id: string, updates: Partial<AISource>) => {
    const newSources = config.sources.map(s =>
      s.id === id ? { ...s, ...updates } : s
    )
    await saveConfig({ ...config, sources: newSources })
  }, [config, saveConfig])

  const setActiveSource = useCallback(async (id: string) => {
    await saveConfig({ ...config, activeSourceId: id })
  }, [config, saveConfig])

  return {
    config,
    isInitialized,
    addSource,
    removeSource,
    updateSource,
    setActiveSource,
    saveConfig,
  }
}

// ============= 兼容旧接口的 Hook =============

export function useSettings() {
  const { config, isInitialized, updateSource, saveConfig } = useAIConfig()

  const settings = configToSettings(config)

  // 兼容旧的 updateSetting 接口
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    const active = config.sources.find(s => s.id === config.activeSourceId)
    if (!active) return

    const fieldMap: Record<keyof Settings, keyof AISource> = {
      aiProvider: 'provider',
      aiBaseUrl: 'baseUrl',
      aiApiKey: 'apiKey',
      aiModel: 'model',
    }
    updateSource(active.id, { [fieldMap[key]]: value })
  }, [config, updateSource])

  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    const active = config.sources.find(s => s.id === config.activeSourceId)
    if (!active) return

    const updates: Partial<AISource> = {}
    if (newSettings.aiProvider !== undefined) updates.provider = newSettings.aiProvider
    if (newSettings.aiBaseUrl !== undefined) updates.baseUrl = newSettings.aiBaseUrl
    if (newSettings.aiApiKey !== undefined) updates.apiKey = newSettings.aiApiKey
    if (newSettings.aiModel !== undefined) updates.model = newSettings.aiModel
    updateSource(active.id, updates)
  }, [config, updateSource])

  const resetSettings = useCallback(() => {
    const active = config.sources.find(s => s.id === config.activeSourceId)
    if (!active) return
    updateSource(active.id, {
      provider: defaultSettings.aiProvider,
      baseUrl: defaultSettings.aiBaseUrl,
      apiKey: defaultSettings.aiApiKey,
      model: defaultSettings.aiModel,
    })
  }, [config, updateSource])

  return {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    isInitialized,
  }
}

// 直接获取设置（用于非 React 环境，如 useAIStream）
export async function getSettings(): Promise<Settings> {
  const config = await loadConfigFromBackend()
  return configToSettings(config)
}

// 同步获取缓存的设置
export function getCachedSettings(): Settings {
  if (cachedConfig) return configToSettings(cachedConfig)
  return defaultSettings
}
