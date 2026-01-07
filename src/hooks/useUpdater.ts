/**
 * 软件更新 Hook
 * 使用 tauri-plugin-updater 检查和安装更新
 */
import { useState, useCallback, useEffect } from 'react'
import { check, Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'

export interface UpdateInfo {
  version: string
  currentVersion: string
  date?: string
  body?: string
}

export interface UpdateProgress {
  downloaded: number
  total: number
  percentage: number
}

export type UpdateStatus = 
  | 'idle'           // 空闲状态
  | 'checking'       // 检查中
  | 'available'      // 有可用更新
  | 'not-available'  // 没有更新
  | 'downloading'    // 下载中
  | 'ready'          // 下载完成，准备安装
  | 'error'          // 错误

export interface UseUpdaterReturn {
  status: UpdateStatus
  updateInfo: UpdateInfo | null
  progress: UpdateProgress | null
  error: string | null
  currentVersion: string
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  downloadAndInstall: () => Promise<void>
}

export function useUpdater(): UseUpdaterReturn {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null)

  // 获取当前版本
  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(console.error)
  }, [])

  // 检查更新
  const checkForUpdates = useCallback(async () => {
    try {
      setStatus('checking')
      setError(null)
      setUpdateInfo(null)
      
      const update = await check()
      
      if (update) {
        setPendingUpdate(update)
        setUpdateInfo({
          version: update.version,
          currentVersion,
          date: update.date,
          body: update.body || undefined,
        })
        setStatus('available')
      } else {
        setStatus('not-available')
      }
    } catch (err) {
      console.error('检查更新失败:', err)
      setError(err instanceof Error ? err.message : '检查更新失败')
      setStatus('error')
    }
  }, [currentVersion])

  // 下载更新
  const downloadUpdate = useCallback(async () => {
    if (!pendingUpdate) {
      setError('没有可用的更新')
      return
    }

    try {
      setStatus('downloading')
      setError(null)
      setProgress({ downloaded: 0, total: 0, percentage: 0 })

      let downloaded = 0
      let contentLength = 0

      await pendingUpdate.download((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength || 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          const percentage = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0
          setProgress({
            downloaded,
            total: contentLength,
            percentage,
          })
        } else if (event.event === 'Finished') {
          setProgress({
            downloaded: contentLength,
            total: contentLength,
            percentage: 100,
          })
        }
      })

      setStatus('ready')
    } catch (err) {
      console.error('下载更新失败:', err)
      setError(err instanceof Error ? err.message : '下载更新失败')
      setStatus('error')
    }
  }, [pendingUpdate])

  // 安装更新
  const installUpdate = useCallback(async () => {
    if (!pendingUpdate) {
      setError('没有可安装的更新')
      return
    }

    try {
      await pendingUpdate.install()
      // 重启应用
      await relaunch()
    } catch (err) {
      console.error('安装更新失败:', err)
      setError(err instanceof Error ? err.message : '安装更新失败')
      setStatus('error')
    }
  }, [pendingUpdate])

  // 下载并安装（一步完成）
  const downloadAndInstall = useCallback(async () => {
    if (!pendingUpdate) {
      setError('没有可用的更新')
      return
    }

    try {
      setStatus('downloading')
      setError(null)
      setProgress({ downloaded: 0, total: 0, percentage: 0 })

      let downloaded = 0
      let contentLength = 0

      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength || 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          const percentage = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0
          setProgress({
            downloaded,
            total: contentLength,
            percentage,
          })
        } else if (event.event === 'Finished') {
          setProgress({
            downloaded: contentLength,
            total: contentLength,
            percentage: 100,
          })
        }
      })

      // 重启应用
      await relaunch()
    } catch (err) {
      console.error('下载安装更新失败:', err)
      setError(err instanceof Error ? err.message : '下载安装更新失败')
      setStatus('error')
    }
  }, [pendingUpdate])

  return {
    status,
    updateInfo,
    progress,
    error,
    currentVersion,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    downloadAndInstall,
  }
}

export default useUpdater
