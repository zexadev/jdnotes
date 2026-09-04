import { useCallback, useEffect, useState } from 'react'
import { initDatabase, noteOperations, type Note } from '../lib/db'
import { NoteListScreen } from './screens/NoteListScreen'
import { NoteScreen } from './screens/NoteScreen'
import { ComposeScreen } from './screens/ComposeScreen'

type Screen = { kind: 'list' } | { kind: 'note'; id: number } | { kind: 'compose' }

// 屏幕栈走浏览器 history：Android 返回手势 → wry 调 webView.goBack() → popstate → 回上一屏。
// 三个屏，不上路由库
export function MobileApp() {
  const [ready, setReady] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })

  const reload = useCallback(async () => {
    const all = await noteOperations.getAll()
    setNotes(all.filter((n) => !n.isDeleted))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // 手机是轻节点：不种 welcome 笔记（固定 uuid 会与桌面的墓碑/编辑在首次同步时打架），空库靠同步或速记填
      await initDatabase()
      if (cancelled) return
      await reload()
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  useEffect(() => {
    history.replaceState({ kind: 'list' } satisfies Screen, '')
    const onPop = (e: PopStateEvent) => {
      setScreen((e.state as Screen | null) ?? { kind: 'list' })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const push = useCallback((next: Screen) => {
    history.pushState(next, '')
    setScreen(next)
  }, [])
  const back = useCallback(() => history.back(), [])

  const openByUuid = useCallback(
    (uuid: string) => {
      const target = notes.find((n) => n.uuid === uuid)
      if (target) push({ kind: 'note', id: target.id })
    },
    [notes, push],
  )

  if (!ready) return <div className="h-full" />

  if (screen.kind === 'note') {
    const note = notes.find((n) => n.id === screen.id)
    if (note) {
      return <NoteScreen note={note} onBack={back} onChanged={reload} onOpenNote={openByUuid} />
    }
  }

  if (screen.kind === 'compose') {
    return <ComposeScreen onBack={back} onCreated={reload} />
  }

  return (
    <NoteListScreen
      notes={notes}
      onOpen={(id) => push({ kind: 'note', id })}
      onCompose={() => push({ kind: 'compose' })}
    />
  )
}
