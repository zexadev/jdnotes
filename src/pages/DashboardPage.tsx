import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useTheme } from '../contexts/ThemeContext'
import { formatDateKey, type Note } from '../lib/db'
import { startOfWeekMonday } from '../hooks/useCalendarPage'
import { tagColor } from '../lib/tagColor'
import type { ViewType } from '../App'

interface DashboardPageProps {
  // App 层唯一 useNotes 实例的数据，统计与全应用同源同刷新
  allNotes: Note[]
  counts: { inbox: number; favorites: number; trash: number }
  onNavigate: (view: ViewType) => void
  onCreateNote: () => void
  onOpenNote: (id: number) => void
  // 热力图点格直达日历该日
  onOpenCalendarDate: (date: Date) => void
}

type Palette = { bg: string; border: string; ink: string; main: string }
type HiKey = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

const HI_LIGHT: Record<HiKey, Palette> = {
  yellow: { bg: '#FEF7DC', border: '#F5DC8C', ink: '#92580E', main: '#fcd34d' },
  green:  { bg: '#E2FAEF', border: '#9EE5C5', ink: '#0F6E4A', main: '#6ee7b7' },
  blue:   { bg: '#E7F1FE', border: '#A4C8F6', ink: '#1E4FA6', main: '#93c5fd' },
  pink:   { bg: '#FDEAF4', border: '#F1B2D2', ink: '#A11E72', main: '#f9a8d4' },
  purple: { bg: '#EFEAFD', border: '#BCAEF1', ink: '#5635B6', main: '#c4b5fd' },
}
const HI_DARK: Record<HiKey, Palette> = {
  yellow: { bg: 'rgba(252,211,77,.10)', border: 'rgba(252,211,77,.28)', ink: '#FDE68A', main: '#fcd34d' },
  green:  { bg: 'rgba(110,231,183,.10)', border: 'rgba(110,231,183,.28)', ink: '#6EE7B7', main: '#6ee7b7' },
  blue:   { bg: 'rgba(147,197,253,.10)', border: 'rgba(147,197,253,.28)', ink: '#93C5FD', main: '#93c5fd' },
  pink:   { bg: 'rgba(249,168,212,.10)', border: 'rgba(249,168,212,.28)', ink: '#F9A8D4', main: '#f9a8d4' },
  purple: { bg: 'rgba(196,181,253,.10)', border: 'rgba(196,181,253,.28)', ink: '#C4B5FD', main: '#c4b5fd' },
}

const PRIMARY = '#5E6AD2'
const HEAT_WEEKS = 14
const CHART_W = 700
const CHART_H = 130
const CHART_P = 8
// 顶部另留标签空间：峰值点 y 恒等于顶部内边距（count===peak 时映射括号为 0），
// 若与横向同用 8px，峰值数字必然画穿峰值圆点
const CHART_PT = 22

type Tip = { x: number; y: number; text: string }

export function DashboardPage({ allNotes, counts, onNavigate, onCreateNote, onOpenNote, onOpenCalendarDate }: DashboardPageProps) {
  const stats = useDashboardStats(allNotes, counts)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const HI = isDark ? HI_DARK : HI_LIGHT

  // 自绘悬停提示（跟随光标），替代原生 title 的迟滞气泡
  const [tip, setTip] = useState<Tip | null>(null)
  const moveTip = (e: React.MouseEvent, text: string) => setTip({ x: e.clientX, y: e.clientY - 12, text })
  const hideTip = () => setTip(null)

  // 趋势区间 7/30 天，跨会话记忆
  const [trendRange, setTrendRangeState] = useState<7 | 30>(() =>
    localStorage.getItem('dashboard.trendRange') === '30' ? 30 : 7
  )
  const setTrendRange = (r: 7 | 30) => {
    setTrendRangeState(r)
    localStorage.setItem('dashboard.trendRange', String(r))
  }
  const [trendHover, setTrendHover] = useState<number | null>(null)

  // viewBox 宽用容器实测像素：固定 700 + preserveAspectRatio=none 会把圆点/数字横向压扁
  const chartWrapRef = useRef<HTMLDivElement>(null)
  const [chartW, setChartW] = useState(CHART_W)
  useEffect(() => {
    const el = chartWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth)
      if (w > 0) setChartW(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const trend = useMemo(() => stats.trendData.slice(-trendRange), [stats.trendData, trendRange])
  const trendPeak = useMemo(() => Math.max(...trend.map((d) => d.count), 1), [trend])

  const chart = useMemo(() => {
    if (trend.length === 0) return { line: '', area: '', points: [] as { x: number; y: number; v: number }[] }
    const points = trend.map((d, i) => ({
      x: CHART_P + (i * (chartW - 2 * CHART_P)) / (trend.length - 1 || 1),
      y: CHART_PT + (CHART_H - CHART_PT - CHART_P) * (1 - d.count / trendPeak),
      v: d.count,
    }))
    const line = smoothLine(points)
    const area = `${line} L${points[points.length - 1].x},${CHART_H} L${points[0].x},${CHART_H} Z`
    return { line, area, points }
  }, [trend, trendPeak, chartW])

  const peakIdx = useMemo(() => chart.points.findIndex((p) => p.v === trendPeak), [chart.points, trendPeak])

  // 热力图：GitHub 式周对齐——列是周（周一起始），行是星期几，近 14 周
  const heat = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = startOfWeekMonday(today)
    start.setDate(start.getDate() - (HEAT_WEEKS - 1) * 7)
    const cells: { date: Date; key: string; count: number; level: 0 | 1 | 2 | 3 | 4; future: boolean }[] = []
    let max = 1
    for (let i = 0; i < HEAT_WEEKS * 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const future = d.getTime() > today.getTime()
      const count = future ? 0 : stats.distribution.get(formatDateKey(d)) || 0
      if (count > max) max = count
      cells.push({ date: d, key: formatDateKey(d), count, level: 0, future })
    }
    for (const c of cells) {
      if (c.count > 0) {
        const r = c.count / max
        c.level = r > 0.66 ? 4 : r > 0.33 ? 3 : r > 0.15 ? 2 : 1
      }
    }
    // 每列（该周周一）所在月份，仅变化处标注
    const monthLabels: (string | null)[] = []
    let lastMonth = -1
    for (let w = 0; w < HEAT_WEEKS; w++) {
      const m = cells[w * 7].date.getMonth()
      monthLabels.push(m !== lastMonth ? `${m + 1}月` : null)
      lastMonth = m
    }
    const active = cells.filter((c) => c.count > 0).length
    return { cells, monthLabels, active }
  }, [stats.distribution])

  const peakHour = useMemo(() => {
    let max = 0
    let hour = 22
    stats.hourlyActivity.forEach((h, i) => {
      if (h.count > max) {
        max = h.count
        hour = i
      }
    })
    return { hour, max }
  }, [stats.hourlyActivity])

  const kpis: { color: HiKey; label: string; value: string; delta: string; nav?: ViewType }[] = [
    { color: 'yellow', label: '笔记总数', value: stats.totalNotes.toLocaleString(), delta: stats.weeklyGrowth > 0 ? `本周 +${stats.weeklyGrowth}` : '本周 0', nav: 'inbox' },
    { color: 'pink',   label: '收藏',     value: stats.favoriteNotes.toLocaleString(), delta: stats.favoriteNotes > 0 ? `占 ${stats.favoriteRatio}%` : '—', nav: 'favorites' },
    { color: 'green',  label: '总字数',   value: stats.totalWords.toLocaleString(), delta: stats.avgWords > 0 ? `均 ${stats.avgWords.toLocaleString()}/篇` : '—' },
    { color: 'blue',   label: '写作天数', value: stats.activeDays.toString(), delta: stats.activeDays > 0 ? `日均 ${Math.round(stats.totalWords / stats.activeDays).toLocaleString()} 字` : '—' },
    { color: 'purple', label: '连续天数', value: stats.streak.toString(), delta: stats.streak === 0 ? '从今天开始' : stats.wroteToday ? '持续中' : '今天还没写' },
  ]

  const top5Tags = stats.topTags.slice(0, 5)
  const tagMax = top5Tags[0]?.count || 1

  const cellColor = (level: 0 | 1 | 2 | 3 | 4): string => {
    const light = ['#EEF2F6', '#E0E3F7', '#B5BAEC', '#8590DE', PRIMARY]
    const dark = ['#1E2025', 'rgba(124,131,224,.22)', 'rgba(124,131,224,.45)', 'rgba(124,131,224,.72)', PRIMARY]
    return isDark ? dark[level] : light[level]
  }

  const relativeTime = (d: Date) => {
    const diff = Date.now() - d.getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return `${m} 分钟前`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} 小时前`
    const dd = Math.floor(h / 24)
    if (dd < 7) return `${dd} 天前`
    return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  }

  // 标签跟随数据点真实 x：justify-between 均分与点位最大差 2.6% 图宽，悬停日期会和脚下标签对不上
  const trendLabelIdx = trendRange === 7 ? trend.map((_, i) => i) : [0, 7, 14, 21, 29]

  return (
    <div className="h-full overflow-y-auto bg-transparent">
      <div className="max-w-[1440px] mx-auto px-5 sm:px-6 py-4 flex flex-col gap-3">

        {/* HERO — 紧凑横条 */}
        <section
          className="relative px-5 py-4 border border-[#E4EAF0] dark:border-[#262932] rounded-xl overflow-hidden flex items-center gap-6"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(124,131,224,.08) 0%, #0B0D11 60%, rgba(196,181,253,.06) 100%)'
              : 'linear-gradient(135deg, rgba(94,106,210,.06) 0%, #F9FBFC 60%, rgba(196,181,253,.14) 100%)',
          }}
        >
          <div
            className="absolute -right-12 -top-12 w-48 h-48 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(94,106,210,.18), transparent 65%)' }}
          />

          <div className="relative z-10 flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: PRIMARY }}>
              <span className="w-1 h-1 rounded-full" style={{ background: PRIMARY, boxShadow: `0 0 10px ${PRIMARY}` }} />
              数据概览
            </div>
            {stats.totalNotes === 0 ? (
              <h1 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-gray-100">
                还没有笔记，<em className="not-italic font-serif" style={{ color: PRIMARY }}>从第一篇开始</em>
              </h1>
            ) : (
              <h1 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-gray-100">
                累计 <em className="not-italic font-serif" style={{ color: PRIMARY }}>{stats.totalWords.toLocaleString()}</em> 字，
                <span className="px-1 ml-1" style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(252,211,77,.55) 60%)' }}>{stats.totalNotes.toLocaleString()} 篇笔记</span>
                {stats.streak > 0 && <span className="text-gray-500 dark:text-gray-400 text-sm ml-2 font-normal">· 连续 {stats.streak} 天</span>}
              </h1>
            )}
          </div>

          <div className="relative z-10 hidden md:grid grid-cols-3 gap-5">
            <MiniStat label="今日" value={`${stats.todayCount} 篇`} />
            <MiniStat label="本周新增" value={`${stats.weeklyGrowth} 篇`} />
            <MiniStat label="高产时段" value={peakHour.max > 0 ? `${peakHour.hour.toString().padStart(2, '0')}:00` : '—'} />
          </div>

          <button
            onClick={onCreateNote}
            className="relative z-10 px-3 h-8 rounded-md text-white text-[13px] font-medium transition-colors flex-shrink-0"
            style={{ background: PRIMARY }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#7C83E0')}
            onMouseOut={(e) => (e.currentTarget.style.background = PRIMARY)}
          >
            + 新建笔记
          </button>
        </section>

        {/* KPI 5 — 有落点的可点进对应视图 */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {kpis.map((k) => {
            const c = HI[k.color]
            const inner = (
              <>
                <div className="flex items-center gap-1.5 text-[11px] font-medium mb-1 tracking-tight" style={{ color: c.ink }}>
                  <span className="w-1.5 h-1.5 rounded-sm" style={{ background: c.main }} />
                  {k.label}
                </div>
                <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-gray-900 dark:text-gray-100">
                  {k.value}
                </div>
                <div className="mt-1 text-[10px] font-medium" style={{ color: c.ink }}>
                  {k.delta}
                </div>
              </>
            )
            return k.nav ? (
              <button
                key={k.label}
                type="button"
                onClick={() => onNavigate(k.nav!)}
                className="group relative px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-black/40"
                style={{ background: c.bg, borderColor: c.border }}
              >
                {inner}
                <span className="absolute top-2 right-2.5 font-mono text-[11px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: c.ink }}>
                  →
                </span>
              </button>
            ) : (
              <div key={k.label} className="relative px-3 py-2.5 rounded-xl border" style={{ background: c.bg, borderColor: c.border }}>
                {inner}
              </div>
            )
          })}
        </section>

        {/* ROW 1: 趋势 + Top 标签 + 时段 */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] gap-3">
          <Card>
            <CardHead
              title="新增"
              titleEm="趋势"
              sub="按创建时间"
              chip={
                <div className="flex gap-1">
                  {([7, 30] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTrendRange(r)}
                      className={`px-2 h-6 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        trendRange === r
                          ? 'text-white'
                          : 'bg-[#EEF2F6] dark:bg-[#1E2025] text-gray-500 dark:text-gray-400 hover:bg-[#E4EAF0] dark:hover:bg-[#262932]'
                      }`}
                      style={trendRange === r ? { background: PRIMARY } : undefined}
                    >
                      {r} 天
                    </button>
                  ))}
                </div>
              }
              tight
            />
            <div ref={chartWrapRef} className="relative h-[130px]">
              <svg viewBox={`0 0 ${chartW} ${CHART_H}`} preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="dashTrendG" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g stroke="currentColor" strokeWidth="1" className="text-[#E4EAF0] dark:text-[#262932]">
                  <line x1="0" y1="32" x2={chartW} y2="32" />
                  <line x1="0" y1="65" x2={chartW} y2="65" />
                  <line x1="0" y1="98" x2={chartW} y2="98" />
                </g>
                {chart.area && <path d={chart.area} fill="url(#dashTrendG)" />}
                {chart.line && <path d={chart.line} fill="none" stroke={PRIMARY} strokeWidth="2" />}
                {chart.points.map((p, i) => {
                  const isPeak = i === peakIdx && trendPeak > 0
                  const showDot = trendRange === 7 || isPeak || trendHover === i
                  return (
                    <g key={i}>
                      {showDot && (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isPeak || trendHover === i ? 4.5 : 3}
                          fill={PRIMARY}
                          stroke={isDark ? '#16181D' : '#FFFFFF'}
                          strokeWidth={isPeak ? 2 : 1.5}
                        />
                      )}
                      {isPeak && (
                        <text x={p.x} y={Math.max(p.y - 8, 12)} textAnchor="middle" fill={isDark ? '#F4F6FA' : '#0F1115'} fontFamily="ui-monospace,Menlo,monospace" fontSize="10" fontWeight="600">
                          {p.v}
                        </text>
                      )}
                      {/* 悬停命中带：竖向整条，鼠标扫过即出提示 */}
                      <rect
                        x={p.x - (chartW - 2 * CHART_P) / (2 * (trend.length - 1 || 1))}
                        y="0"
                        width={(chartW - 2 * CHART_P) / (trend.length - 1 || 1)}
                        height={CHART_H}
                        fill="transparent"
                        onMouseMove={(e) => {
                          setTrendHover(i)
                          moveTip(e, `${trend[i].date} · ${p.v} 篇`)
                        }}
                        onMouseLeave={() => {
                          setTrendHover(null)
                          hideTip()
                        }}
                      />
                    </g>
                  )
                })}
              </svg>
            </div>
            <div className="relative mt-1.5 h-[13px] font-mono text-[10px] text-gray-400 dark:text-gray-500 tracking-wider">
              {trendLabelIdx.map((idx, j) => (
                <span
                  key={idx}
                  className="absolute top-0 whitespace-nowrap"
                  style={{
                    left: `${((chart.points[idx]?.x ?? 0) / chartW) * 100}%`,
                    transform: j === 0 ? undefined : j === trendLabelIdx.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  {trend[idx]?.date}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Top 5" titleEm="标签" tight />
            {top5Tags.length === 0 ? (
              <EmptyHint text="还没有标签" small />
            ) : (
              <div className="flex flex-col gap-1">
                {top5Tags.map((t) => {
                  const c = tagColor(t.name)
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => onNavigate(`tag-${t.name}`)}
                      onMouseMove={(e) => moveTip(e, `#${t.name} · ${t.count} 篇`)}
                      onMouseLeave={hideTip}
                      className="flex items-center gap-2 text-[12px] rounded-md px-1.5 py-1 -mx-1.5 cursor-pointer transition-colors hover:bg-[#F3F6F9] dark:hover:bg-[#1C1F26]"
                    >
                      <span className="font-medium px-2 py-0.5 rounded text-center flex-shrink-0 w-16 truncate text-[11px] text-slate-600 dark:text-slate-300" style={{ background: c.bg }}>
                        #{t.name}
                      </span>
                      <span className="flex-1 h-1.5 bg-[#EEF2F6] dark:bg-[#1E2025] rounded-full overflow-hidden">
                        <span className="block h-full rounded-full" style={{ width: `${(t.count / tagMax) * 100}%`, background: c.base }} />
                      </span>
                      <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300 w-6 text-right tabular-nums">{t.count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="活跃" titleEm="时段" sub="24h" tight />
            <HoursBar hourly={stats.hourlyActivity} peakHour={peakHour.hour} onTip={moveTip} onTipHide={hideTip} />
            <div className="flex justify-between mt-1 font-mono text-[10px] text-gray-400 dark:text-gray-500 tracking-wider">
              <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
            </div>
            {peakHour.max > 0 && (
              <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                高产时段 <b className="font-semibold" style={{ color: PRIMARY }}>{peakHour.hour.toString().padStart(2, '0')}:00</b>，共 {peakHour.max} 篇
              </div>
            )}
          </Card>
        </section>

        {/* ROW 2: 热力图 + 待办提醒 + 最近笔记 */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] gap-3">
          <Card>
            <CardHead
              title="热力图"
              sub={`近 ${HEAT_WEEKS} 周 · ${heat.active} 天活跃 · 点格子看当天`}
              chip={
                <div className="inline-flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((l) => (
                    <i key={l} className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: cellColor(l as 0 | 1 | 2 | 3 | 4) }} />
                  ))}
                </div>
              }
              tight
            />
            <div className="flex gap-1.5">
              <div className="flex flex-col flex-shrink-0">
                <div className="h-[14px]" />
                <div className="flex-1 grid gap-[3px]" style={{ gridTemplateRows: 'repeat(7, 1fr)' }}>
                  {['一', '', '三', '', '五', '', '日'].map((w, i) => (
                    <span key={i} className="flex items-center font-mono text-[9px] leading-none text-gray-400 dark:text-gray-500">{w}</span>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="h-[14px] grid" style={{ gridTemplateColumns: `repeat(${HEAT_WEEKS}, 1fr)` }}>
                  {heat.monthLabels.map((m, i) => (
                    <span key={i} className="font-mono text-[9px] leading-none text-gray-400 dark:text-gray-500 whitespace-nowrap">{m}</span>
                  ))}
                </div>
                <div className="grid gap-[3px]" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 1fr)', gridTemplateColumns: `repeat(${HEAT_WEEKS}, 1fr)` }}>
                  {heat.cells.map((cell) =>
                    cell.future ? (
                      <span key={cell.key} />
                    ) : (
                      <button
                        key={cell.key}
                        type="button"
                        aria-label={`${cell.date.getMonth() + 1}月${cell.date.getDate()}日 · ${cell.count} 篇`}
                        className="aspect-square rounded-[3px] cursor-pointer transition-transform hover:scale-110"
                        style={{ background: cellColor(cell.level) }}
                        onClick={() => onOpenCalendarDate(cell.date)}
                        onMouseMove={(e) => moveTip(e, `${cell.date.getMonth() + 1}月${cell.date.getDate()}日 · ${cell.count} 篇`)}
                        onMouseLeave={hideTip}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              title="待办"
              titleEm="提醒"
              sub={stats.reminderItems.length > 0 ? `${stats.reminderItems.filter((r) => r.date.getTime() > Date.now()).length} 条待办` : undefined}
              chip={
                <button
                  type="button"
                  onClick={() => onNavigate('calendar')}
                  className="px-2 h-6 rounded-md text-[11px] font-medium cursor-pointer transition-colors bg-[#EEF2F6] dark:bg-[#1E2025] text-gray-600 dark:text-gray-300 hover:bg-[#E4EAF0] dark:hover:bg-[#262932]"
                >
                  日历
                </button>
              }
              tight
            />
            {stats.reminderItems.length === 0 ? (
              <EmptyHint text="暂无提醒 — 在日历里给笔记设一个" small />
            ) : (
              <div className="flex flex-col">
                {stats.reminderItems.slice(0, 5).map((r) => {
                  // 过期与否按渲染时刻算：hook memo 里冻结的钟跨零点会把刚过期的标成未来
                  const overdue = r.date.getTime() <= Date.now()
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onOpenNote(r.id)}
                      className="grid grid-cols-[auto_1fr_auto] gap-2 py-1.5 border-b border-[#EEF2F6] dark:border-[#1C1F26] last:border-0 first:pt-0 items-center text-left cursor-pointer group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: overdue ? '#EF4444' : PRIMARY }} />
                      <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 group-hover:text-[#5E6AD2] dark:group-hover:text-[#7C83E0] transition-colors truncate">
                        {r.title || '未命名笔记'}
                      </span>
                      <span className={`font-mono text-[10px] whitespace-nowrap ${overdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                        {formatReminderTime(r.date, overdue)}
                      </span>
                    </button>
                  )
                })}
                {stats.reminderItems.length > 5 && (
                  <div className="pt-1.5 text-[11px] text-gray-400 dark:text-gray-500">还有 {stats.reminderItems.length - 5} 条</div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHead
              title="最近笔记"
              sub="按编辑时间"
              chip={
                <button
                  type="button"
                  onClick={() => onNavigate('inbox')}
                  className="px-2 h-6 rounded-md text-[11px] font-medium cursor-pointer transition-colors bg-[#EEF2F6] dark:bg-[#1E2025] text-gray-600 dark:text-gray-300 hover:bg-[#E4EAF0] dark:hover:bg-[#262932]"
                >
                  全部
                </button>
              }
              tight
            />
            {stats.recentNotes.length === 0 ? (
              <EmptyHint text="还没有笔记 — 点新建第一篇" small />
            ) : (
              <div className="flex flex-col">
                {stats.recentNotes.slice(0, 5).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onOpenNote(n.id)}
                    className="grid grid-cols-[1fr_auto] gap-2 py-1.5 border-b border-[#EEF2F6] dark:border-[#1C1F26] last:border-0 first:pt-0 items-center text-left cursor-pointer group"
                  >
                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 group-hover:text-[#5E6AD2] dark:group-hover:text-[#7C83E0] transition-colors line-clamp-1">
                      {n.title || '未命名笔记'}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap uppercase tracking-wider">
                      {relativeTime(n.updatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>

      {tip && (
        <div
          className="fixed z-50 pointer-events-none px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap -translate-x-1/2 -translate-y-full shadow-lg"
          style={{ left: tip.x, top: tip.y, background: isDark ? '#272B35' : '#1C1F26', color: '#F4F6FA' }}
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}

/* ============ 子组件 ============ */

// Catmull-Rom 转三次贝塞尔的平滑折线；控制点纵向钳在图表内，防尖峰数据过冲出界
function smoothLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
  const clampY = (y: number) => Math.min(Math.max(y, 2), CHART_H - 2)
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6)
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6)
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function formatReminderTime(d: Date, overdue: boolean): string {
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const startOfD = new Date(d)
  startOfD.setHours(0, 0, 0, 0)
  // 日历日差必须比两个本地零点：直接拿时刻差 floor 会在 DST 转换周差一天（23h/25h 的天）。
  // 两个本地零点之差恒为 N·24h±1h，round 吸收偏差
  const dayDiff = Math.round((startOfD.getTime() - startToday.getTime()) / 86400000)
  const year = d.getFullYear() !== startToday.getFullYear() ? `${d.getFullYear()}年` : ''
  if (dayDiff === 0) return `今天 ${time}`
  if (overdue) {
    if (dayDiff === -1) return `昨天 ${time}`
    return `${year}${d.getMonth() + 1}月${d.getDate()}日 ${time}`
  }
  if (dayDiff === 1) return `明天 ${time}`
  if (dayDiff < 7) return `周${'日一二三四五六'[d.getDay()]} ${time}`
  return `${year}${d.getMonth() + 1}月${d.getDate()}日 ${time}`
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[15px] font-semibold leading-none tracking-tight tabular-nums text-gray-900 dark:text-gray-100">{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#16181D] border border-[#E4EAF0] dark:border-[#262932] rounded-xl px-4 py-3 shadow-[0_1px_0_rgba(20,30,55,.02),0_2px_8px_rgba(20,30,55,.03)] dark:shadow-[0_1px_0_rgba(0,0,0,.4),0_2px_8px_rgba(0,0,0,.2)]">
      {children}
    </div>
  )
}

function CardHead({ title, titleEm, sub, chip, tight }: { title: string; titleEm?: string; sub?: string; chip?: React.ReactNode; tight?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${tight ? 'mb-2' : 'mb-4'}`}>
      <div className="min-w-0 flex items-baseline gap-1.5">
        <div className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {title}{' '}
          {titleEm && <em className="not-italic font-serif" style={{ color: PRIMARY }}>{titleEm}</em>}
        </div>
        {sub && <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">· {sub}</div>}
      </div>
      {chip && <div className="flex-shrink-0">{chip}</div>}
    </div>
  )
}

function EmptyHint({ text, small }: { text: string; small?: boolean }) {
  return <div className={`text-center text-gray-400 dark:text-gray-500 ${small ? 'py-3 text-[12px]' : 'py-8 text-sm'}`}>{text}</div>
}

function HoursBar({
  hourly,
  peakHour,
  onTip,
  onTipHide,
}: {
  hourly: { hour: string; count: number }[]
  peakHour: number
  onTip: (e: React.MouseEvent, text: string) => void
  onTipHide: () => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...hourly.map((h) => h.count), 1)
  return (
    <div className="items-end gap-[2px] h-[88px] grid" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
      {hourly.map((h, i) => {
        const height = Math.max(4, (h.count / max) * 100)
        const isPeak = i === peakHour && h.count > 0
        return (
          <span
            key={i}
            className="block rounded-t-sm transition-colors cursor-default"
            style={{
              height: `${height}%`,
              background: isPeak ? PRIMARY : hovered === i ? 'rgba(94,106,210,.45)' : 'rgba(94,106,210,.18)',
              boxShadow: isPeak ? `0 0 6px rgba(94,106,210,.4)` : undefined,
            }}
            onMouseMove={(e) => {
              setHovered(i)
              onTip(e, `${i}:00 – ${(i + 1) % 24}:00 · ${h.count} 篇`)
            }}
            onMouseLeave={() => {
              setHovered(null)
              onTipHide()
            }}
          />
        )
      })}
    </div>
  )
}
