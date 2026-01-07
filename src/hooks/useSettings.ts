import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface Settings {
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
}

const defaultSettings: Settings = {
  aiBaseUrl: 'https://api.deepseek.com',
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
        aiBaseUrl: string
        aiApiKey: string
        aiModel: string
      }>('get_ai_settings')
      
      cachedSettings = {
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
