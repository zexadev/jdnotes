import { useEffect, useRef, useCallback } from 'react'
import { noteOperations } from '../lib/db'

interface UseAutoSaveOptions {
  noteId: number | null
  title: string
  content: string
  isEditing: boolean // 是否处于编辑模式，只有编辑模式下才触发自动保存
  delay?: number
  onSave?: () => void // 保存成功后的回调
}

// 待保存数据的类型
interface PendingData {
  noteId: number
  title: string
  content: string
}

// 全局保存队列，确保页面关闭时能访问到
let globalPendingData: PendingData | null = null

// 同步保存函数（用于 beforeunload）
function syncSave(data: PendingData | null) {
  if (!data) return
  
  // 使用 navigator.sendBeacon 或者同步 XMLHttpRequest 作为备选
  // 但由于我们使用 IndexedDB，这里我们使用 localStorage 作为临时缓存
  try {
    const pendingKey = `jdnotes_pending_save_${data.noteId}`
    localStorage.setItem(pendingKey, JSON.stringify({
      title: data.title,
      content: data.content,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.error('Failed to save pending data to localStorage:', e)
  }
}

// 在应用启动时恢复未保存的数据
export async function recoverPendingSaves() {
  const keysToRemove: string[] = []
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('jdnotes_pending_save_')) {
      try {
        const noteIdStr = key.replace('jdnotes_pending_save_', '')
        const noteId = parseInt(noteIdStr, 10)
        const data = JSON.parse(localStorage.getItem(key) || '{}')
        
        if (data.title !== undefined && data.content !== undefined) {
          // 检查笔记是否存在
          const note = await noteOperations.get(noteId)
          if (note) {
            // 恢复数据
            await noteOperations.update(noteId, {
              title: data.title,
              content: data.content
            })
            console.log(`Recovered pending save for note ${noteId}`)
          }
        }
        
        keysToRemove.push(key)
      } catch (e) {
        console.error('Failed to recover pending save:', e)
        keysToRemove.push(key!)
      }
    }
  }
  
  // 清理已恢复的数据
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

export function useAutoSave({
  noteId,
  title,
  content,
  isEditing,
  delay = 500,
  onSave,
}: UseAutoSaveOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef({ title: '', content: '' })
  const isFirstRender = useRef(true)
  const isSavingRef = useRef(false)
  
  // 使用 ref 存储当前数据，避免闭包问题
  const currentDataRef = useRef({ noteId, title, content })
  currentDataRef.current = { noteId, title, content }
  
  // 使用 ref 存储 onSave 回调，避免闭包问题
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  
  // 存储上一个 noteId，用于检测笔记切换
  const prevNoteIdRef = useRef<number | null>(null)

  // 检查是否有未保存的变化
  const hasUnsavedChanges = useCallback(() => {
    return (
      lastSavedRef.current.title !== currentDataRef.current.title ||
      lastSavedRef.current.content !== currentDataRef.current.content
    )
  }, [])

  // 保存函数 - 使用 ref 中的数据
  const saveWithData = useCallback(async (
    targetNoteId: number,
    targetTitle: string,
    targetContent: string
  ) => {
    // 防止重复保存
    if (isSavingRef.current) {
      console.log('[AutoSave] saveWithData - 跳过（正在保存中）')
      return
    }
    
    try {
      isSavingRef.current = true
      console.log('[AutoSave] saveWithData - 保存笔记:', targetNoteId, '标题:', targetTitle, '内容:', targetContent.substring(0, 50) + '...')
      
      await noteOperations.update(targetNoteId, {
        title: targetTitle,
        content: targetContent
      })
      
      console.log('[AutoSave] saveWithData - 保存成功')
      
      // 只有当保存的是当前笔记时才更新 lastSavedRef
      if (targetNoteId === currentDataRef.current.noteId) {
        lastSavedRef.current = { title: targetTitle, content: targetContent }
      }
      
      // 清除 localStorage 中的临时数据
      localStorage.removeItem(`jdnotes_pending_save_${targetNoteId}`)
      
      // 清除全局待保存数据
      if (globalPendingData?.noteId === targetNoteId) {
        globalPendingData = null
      }
      
      // 保存成功后调用回调，刷新列表
      onSaveRef.current?.()
    } catch (error) {
      console.error('[AutoSave] saveWithData - 保存失败:', error)
    } finally {
      isSavingRef.current = false
    }
  }, [])

  // 当前笔记的保存函数
  const save = useCallback(async () => {
    const { noteId: currentNoteId, title: currentTitle, content: currentContent } = currentDataRef.current
    
    console.log('[AutoSave] save - currentDataRef:', { noteId: currentNoteId, title: currentTitle, content: currentContent.substring(0, 50) + '...' })
    console.log('[AutoSave] save - lastSavedRef:', { title: lastSavedRef.current.title, content: lastSavedRef.current.content.substring(0, 50) + '...' })
    
    if (currentNoteId === null) {
      console.log('[AutoSave] save - 跳过（noteId 为 null）')
      return
    }
    
    // 检查是否有变化
    if (
      lastSavedRef.current.title === currentTitle &&
      lastSavedRef.current.content === currentContent
    ) {
      console.log('[AutoSave] save - 跳过（无变化）')
      return
    }

    console.log('[AutoSave] save - 有变化，准备保存')
    await saveWithData(currentNoteId, currentTitle, currentContent)
  }, [saveWithData])

  // 立即保存（用于关键时刻）
  const saveImmediately = useCallback(async () => {
    // 清除待执行的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    await save()
  }, [save])

  // 防抖保存 - 只在编辑模式下触发
  useEffect(() => {
    // 跳过首次渲染
    if (isFirstRender.current) {
      isFirstRender.current = false
      lastSavedRef.current = { title, content }
      return
    }

    // 只在编辑模式下触发自动保存
    if (!isEditing) {
      console.log('[AutoSave] 防抖保存 - 跳过（非编辑模式）')
      return
    }

    if (noteId === null) return

    // 更新全局待保存数据
    if (hasUnsavedChanges()) {
      globalPendingData = { noteId, title, content }
    }

    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // 设置新的定时器
    timeoutRef.current = setTimeout(() => {
      save()
    }, delay)

    // 清理函数
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [noteId, title, content, isEditing, delay, save, hasUnsavedChanges])

  // 当 noteId 变化时，重置状态（不再自动保存旧笔记，由调用方显式保存）
  useEffect(() => {
    // 检测 noteId 是否真的变化了（而不是首次渲染）
    if (prevNoteIdRef.current !== null && prevNoteIdRef.current !== noteId) {
      console.log('[AutoSave] noteId 变化:', prevNoteIdRef.current, '->', noteId)
      // 清除待执行的定时器，避免保存到错误的笔记
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // 重置状态 - 只在 noteId 真正变化时重置
      isFirstRender.current = true
      lastSavedRef.current = { title, content }
    }

    // 更新前一个笔记的引用
    prevNoteIdRef.current = noteId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]) // 只依赖 noteId，避免 title/content 变化时误触发

  // 保存指定笔记的数据（供外部在切换笔记时调用）
  const saveNoteById = useCallback(async (
    targetNoteId: number,
    targetTitle: string,
    targetContent: string
  ) => {
    console.log('[AutoSave] saveNoteById - 保存指定笔记:', targetNoteId)
    await saveWithData(targetNoteId, targetTitle, targetContent)
  }, [saveWithData])

  // 页面可见性变化时保存
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 页面隐藏时立即保存
        if (hasUnsavedChanges()) {
          // 同步保存到 localStorage 作为备份
          if (currentDataRef.current.noteId !== null) {
            syncSave({
              noteId: currentDataRef.current.noteId,
              title: currentDataRef.current.title,
              content: currentDataRef.current.content
            })
          }
          // 同时尝试异步保存到数据库
          save()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [save, hasUnsavedChanges])

  // 页面关闭前保存
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges() && currentDataRef.current.noteId !== null) {
        // 同步保存到 localStorage
        syncSave({
          noteId: currentDataRef.current.noteId,
          title: currentDataRef.current.title,
          content: currentDataRef.current.content
        })
        
        // 显示确认对话框（某些浏览器需要）
        e.preventDefault()
        // Chrome 需要设置 returnValue
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  // 组件卸载时保存
  useEffect(() => {
    return () => {
      // 同步保存到 localStorage 作为最后保障
      if (currentDataRef.current.noteId !== null) {
        const { noteId: id, title: t, content: c } = currentDataRef.current
        if (
          lastSavedRef.current.title !== t ||
          lastSavedRef.current.content !== c
        ) {
          syncSave({ noteId: id, title: t, content: c })
        }
      }
    }
  }, [])

  return { save, saveImmediately, saveNoteById, hasUnsavedChanges }
}
