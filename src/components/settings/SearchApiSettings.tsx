import { useState, useEffect, useCallback, useRef } from 'react'
import { Eye, EyeOff, Check, Loader2, ExternalLink, Search, Plus, Trash2, RefreshCw } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Select } from '../common/Select'
import type { SelectOption } from '../common/Select'
import { toast } from '../../lib/toast'

type ProviderId = 'tavily' | 'brave' | 'serper' | 'jina'

interface ProviderEntry {
  provider: ProviderId
  apiKey: string
  enabled: boolean
}

// 各家元信息：申请地址 + 免费额度 + key 前缀提示
const PROVIDER_META: Record<ProviderId, { label: string; quota: string; url: string; placeholder: string }> = {
  tavily: { label: 'Tavily', quota: '1000 次/月', url: 'https://app.tavily.com/home', placeholder: 'tvly-...' },
  brave: { label: 'Brave Search', quota: '2000 次/月', url: 'https://brave.com/search/api/', placeholder: 'BSA...' },
  serper: { label: 'Serper', quota: '2500 次免费', url: 'https://serper.dev/', placeholder: '...' },
  jina: { label: 'Jina AI', quota: '免费额度', url: 'https://jina.ai/api-dashboard/', placeholder: 'jina_...' },
}

const PROVIDER_OPTIONS: SelectOption<ProviderId>[] = (Object.keys(PROVIDER_META) as ProviderId[]).map((id) => ({
  value: id,
  label: PROVIDER_META[id].label,
  description: `免费 ${PROVIDER_META[id].quota}`,
}))

// 联网搜索 API 配置：可配多个平台，搜索时轮换使用、某个限流自动切换，摊平免费额度。
// 都不配则回退内置抓取。
export function SearchApiSettings() {
  const [providers, setProviders] = useState<ProviderEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    invoke<{ providers: ProviderEntry[] }>('get_search_api_config')
      .then((cfg) => setProviders(cfg.providers || []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // 防抖保存整个列表
  const persist = useCallback((list: ProviderEntry[]) => {
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        // 只存有 key 的项，避免存一堆空壳
        const clean = list.filter((p) => p.apiKey.trim()).map((p) => ({ ...p, apiKey: p.apiKey.trim() }))
        await invoke('save_search_api_config', { providers: clean })
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 1500)
      } catch (e) {
        setSaveState('idle')
        toast.error('保存搜索配置失败：' + (e instanceof Error ? e.message : String(e)))
      }
    }, 500)
  }, [])

  const update = (list: ProviderEntry[]) => {
    setProviders(list)
    persist(list)
  }

  const addProvider = () => {
    // 默认加一个还没被配置过的平台
    const used = new Set(providers.map((p) => p.provider))
    const next = (Object.keys(PROVIDER_META) as ProviderId[]).find((id) => !used.has(id)) || 'tavily'
    setProviders([...providers, { provider: next, apiKey: '', enabled: true }])
  }

  if (!loaded) return null

  const enabledCount = providers.filter((p) => p.enabled && p.apiKey.trim()).length

  return (
    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
      <div className="mb-2 flex items-center gap-2">
        <Search className="h-4 w-4 text-[#5E6AD2]" strokeWidth={1.5} />
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">联网搜索</h3>
        {enabledCount >= 2 && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            <RefreshCw className="h-2.5 w-2.5" /> {enabledCount} 家轮换
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        AI 的 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[12px]">web_search</code> 工具用它联网。内置抓取免费但对中文/实时查询不可靠；
        配置专业 API 后结果显著更好。<b>配多个平台会自动轮换、某个用完额度切下一个</b>，摊平各家免费额度。都不填则用内置抓取。
      </p>

      <div className="space-y-2.5 max-w-2xl">
        {providers.map((entry, idx) => {
          const meta = PROVIDER_META[entry.provider]
          return (
            <div
              key={idx}
              className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                entry.enabled
                  ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40'
                  : 'border-gray-200/50 dark:border-gray-700/50 opacity-60'
              }`}
            >
              {/* 启用开关 */}
              <button
                onClick={() => update(providers.map((p, i) => (i === idx ? { ...p, enabled: !p.enabled } : p)))}
                className={`flex-shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                  entry.enabled ? 'bg-[#5E6AD2]' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                title={entry.enabled ? '已启用' : '已停用'}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${entry.enabled ? 'left-4' : 'left-0.5'}`} />
              </button>

              {/* 平台选择 */}
              <div className="w-32 flex-shrink-0">
                <Select
                  value={entry.provider}
                  options={PROVIDER_OPTIONS}
                  onChange={(v) => update(providers.map((p, i) => (i === idx ? { ...p, provider: v } : p)))}
                />
              </div>

              {/* Key 输入 */}
              <div className="relative flex-1 min-w-0">
                <input
                  type={showKeys[idx] ? 'text' : 'password'}
                  value={entry.apiKey}
                  onChange={(e) => update(providers.map((p, i) => (i === idx ? { ...p, apiKey: e.target.value } : p)))}
                  placeholder={`${meta.label} API Key（${meta.placeholder}）`}
                  className="w-full px-3 py-2 pr-9 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
                />
                <button
                  onClick={() => setShowKeys((s) => ({ ...s, [idx]: !s[idx] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showKeys[idx] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* 申请链接 */}
              <button
                onClick={() => openUrl(meta.url)}
                className="flex-shrink-0 flex items-center gap-1 text-[12px] text-[#5E6AD2] hover:underline whitespace-nowrap"
                title={`免费申请（${meta.quota}）`}
              >
                申请 <ExternalLink className="h-3 w-3" />
              </button>

              {/* 删除 */}
              <button
                onClick={() => update(providers.filter((_, i) => i !== idx))}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="移除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={addProvider}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#5E6AD2] hover:bg-[#5E6AD2]/10 rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> 添加搜索平台
          </button>
          <span className="text-[12px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
            {saveState === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> 保存中</>}
            {saveState === 'saved' && <><Check className="h-3 w-3 text-emerald-500" /> 已保存</>}
          </span>
        </div>
      </div>

      <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-3">
        Key 存在本地配置文件，不上传。某平台 API 不可用（限流/失效）时会自动切换到下一个，全部不可用才回退内置抓取。
      </p>
    </div>
  )
}
