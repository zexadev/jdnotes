import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

// AI 提供商类型
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'ollama'

// 提供商预设配置
export interface ProviderPreset {
  name: string
  baseUrl: string
  defaultModel: string
  apiKeyPlaceholder: string
  apiKeyRequired: boolean
  description: string
}

// 提供商预设配置列表（baseUrl 包含完整路径前缀）
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

// 常用 OpenAI 兼容服务预设（baseUrl 包含完整路径前缀，代码只追加 /chat/completions）
export const OPENAI_COMPATIBLE_PRESETS = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '智谱AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
]

export interface Settings {
  aiProvider: AIProvider
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
}

const defaultSettings: Settings = {
  aiProvider: 'openai',
  aiBaseUrl: 'https://api.deepseek.com/v1',
  aiApiKey: '',
  aiModel: 'deepseek-chat',
}

// 缓存设置，避免重复加载
let cachedSettings: Settings | null = null
let isLoading = false
let loadPromise: Promise<Settings> | null = null

// 从后端加载设置
async function loadSettingsFromBackend(): Promise<Settings> {
  // 如果已有缓存，直接返回
  if (cachedSettings) {
    return cachedSettings
  }
  
  // 如果正在加载，返回已有的 Promise
  if (isLoading && loadPromise) {
    return loadPromise
  }
  
  isLoading = true
  loadPromise = (async () => {
    try {
      const result = await invoke<{
        aiProvider: string
        aiBaseUrl: string
        aiApiKey: string
        aiModel: string
      }>('get_ai_settings')
      
      // 验证 provider 是否为有效值
      const validProviders: AIProvider[] = ['openai', 'anthropic', 'google', 'ollama']
      const provider = validProviders.includes(result.aiProvider as AIProvider)
        ? (result.aiProvider as AIProvider)
        : defaultSettings.aiProvider
      
      cachedSettings = {
        aiProvider: provider,
        aiBaseUrl: result.aiBaseUrl || defaultSettings.aiBaseUrl,
        aiApiKey: result.aiApiKey || defaultSettings.aiApiKey,
        aiModel: result.aiModel || defaultSettings.aiModel,
      }
      return cachedSettings
    } catch (e) {
      console.error('Failed to load settings from backend:', e)
      cachedSettings = defaultSettings
      return defaultSettings
    } finally {
      isLoading = false
    }
  })()
  
  return loadPromise
}

// 保存设置到后端
async function saveSettingsToBackend(settings: Settings): Promise<void> {
  try {
    await invoke('save_ai_settings', {
      provider: settings.aiProvider,
      baseUrl: settings.aiBaseUrl,
      apiKey: settings.aiApiKey,
      model: settings.aiModel,
    })
    // 更新缓存
    cachedSettings = settings
  } catch (e) {
    console.error('Failed to save settings to backend:', e)
    throw e
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(cachedSettings || defaultSettings)
  const [isInitialized, setIsInitialized] = useState(!!cachedSettings)

  // 初始化时从后端加载设置
  useEffect(() => {
    if (!isInitialized) {
      loadSettingsFromBackend().then((loadedSettings) => {
        setSettingsState(loadedSettings)
        setIsInitialized(true)
      })
    }
  }, [isInitialized])

  // 更新单个设置项
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, [key]: value }
      // 异步保存到后端
      saveSettingsToBackend(newSettings).catch((e) => {
        console.error('Failed to save setting:', e)
      })
      return newSettings
    })
  }, [])

  // 更新所有设置
  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettingsState((prev) => {
      const merged = { ...prev, ...newSettings }
      // 异步保存到后端
      saveSettingsToBackend(merged).catch((e) => {
        console.error('Failed to save settings:', e)
      })
      return merged
    })
  }, [])

  // 重置为默认设置
  const resetSettings = useCallback(() => {
    setSettingsState(defaultSettings)
    saveSettingsToBackend(defaultSettings).catch((e) => {
      console.error('Failed to reset settings:', e)
    })
  }, [])

  return {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    isInitialized,
  }
}

// 直接获取设置（用于非 React 环境）
export async function getSettings(): Promise<Settings> {
  return loadSettingsFromBackend()
}

// 同步获取缓存的设置（可能为空）
export function getCachedSettings(): Settings {
  return cachedSettings || defaultSettings
}
