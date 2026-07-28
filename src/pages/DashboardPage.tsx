import { useMemo } from 'react'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useTheme } from '../contexts/ThemeContext'
import { formatDateKey } from '../lib/db'

interface DashboardPageProps {
  onNavigate: (view: 'inbox' | 'favorites' | 'calendar') => void
  onCreateNote: () => void
  onOpenNote: (id: number) => void
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

export function DashboardPage({ onNavigate, onCreateNote, onOpenNote }: DashboardPageProps) {
  const stats = useDashboardStats()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const HI = isDark ? HI_DARK : HI_LIGHT

  const last7 = useMemo(() => stats.trendData.slice(-7), [stats.trendData])
  const peak7 = useMemo(() => Math.max(...last7.map((d) => d.count), 1), [last7])

  const heatmap = useMemo(() => {
    const cells: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] = []
    const now = new Date()
    const raw: { date: string; count: number }[] = []
    for (let i = 90; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = formatDateKey(d)
      raw.push({ date: key, count: stats.distribution.get(key) || 0 })
    }
    const max = Math.max(...raw.map((c) => c.count), 1)
    raw.forEach(({ date, count }) => {
      let level: 0 | 1 | 2 | 3 | 4 = 0
      if (count > 0) {
        const ratio = count / max
        if (ratio > 0.66) level = 4
        else if (ratio > 0.33) level = 3
        else if (ratio > 0.15) level = 2
        else level = 1
      }
      cells.push({ date, count, level })
    })
    return cells
  }, [stats.distribution])

  const activeInHeatmap = heatmap.filter((c) => c.count > 0).length

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

  const kpis: { color: HiKey; label: string; value: string; delta?: string }[] = [
    { color: 'yellow', label: '笔记总数',  value: stats.totalNotes.toLocaleString(),  delta: stats.weeklyGrowth > 0 ? `本周 +${stats.weeklyGrowth}` : '本周 0' },
    { color: 'green',  label: '总字数',    value: stats.totalWords.toLocaleString(),  delta: stats.avgWords > 0 ? `${stats.avgWords.toLocaleString()} 均/篇` : '—' },
    { color: 'blue',   label: '写作天数',  value: stats.activeDays.toString(),        delta: `共 ${stats.activeDays} 天` },
    { color: 'pink',   label: '活跃标签',  value: stats.topTags.length.toString(),    delta: stats.topTags[0] ? `Top: #${stats.topTags[0].name}` : '—' },
    { color: 'purple', label: '连续天数',  value: stats.streak.toString(),            delta: stats.streak > 0 ? '🔥 持续中' : '从今天开始' },
  ]

  const tagColors: HiKey[] = ['yellow', 'purple', 'green', 'blue', 'pink']
  const top5Tags = stats.topTags.slice(0, 5)
  const tagMax = top5Tags[0]?.count || 1

  const chartPath = useMemo(() => {
    if (last7.length === 0) return { line: '', area: '', points: [] as { x: number; y: number; v: number }[] }
    const W = 700, H = 130, P = 8
    const xs = last7.map((_, i) => P + (i * (W - 2 * P)) / (last7.length - 1 || 1))
    const ys = last7.map((d) => P + (H - 2 * P) * (1 - d.count / peak7))
    const points = last7.map((d, i) => ({ x: xs[i], y: ys[i], v: d.count }))
    const line = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ')
    const area = `${line} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`
    return { line, area, points }
  }, [last7, peak7])

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
            <h1 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-gray-100">
              累计 <em className="not-italic font-serif" style={{ color: PRIMARY }}>{stats.totalWords.toLocaleString()}</em> 字，
              <span className="px-1 ml-1" style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(252,211,77,.55) 60%)' }}>{stats.totalNotes.toLocaleString()} 篇笔记</span>
              {stats.streak > 0 && <span className="text-gray-500 dark:text-gray-400 text-sm ml-2 font-normal">· 连续 {stats.streak} 天</span>}
            </h1>
          </div>

          <div className="relative z-10 hidden md:grid grid-cols-3 gap-5">
            <MiniStat label="日均" value={stats.activeDays > 0 ? Math.round(stats.totalWords / stats.activeDays).toLocaleString() : '—'} />
            <MiniStat label="高产时段" value={peakHour.max > 0 ? `${peakHour.hour.toString().padStart(2, '0')}:00` : '—'} />
            <MiniStat label="本周新增" value={`${stats.weeklyGrowth} 篇`} />
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

        {/* KPI 5 — 紧凑 */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {kpis.map((k) => {
            const c = HI[k.color]
            return (
              <div
                key={k.label}
                className="relative px-3 py-2.5 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-black/40"
                style={{ background: c.bg, borderColor: c.border }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium mb-1 tracking-tight" style={{ color: c.ink }}>
                  <span className="w-1.5 h-1.5 rounded-sm" style={{ background: c.main }} />
                  {k.label}
                </div>
                <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-gray-900 dark:text-gray-100">
                  {k.value}
                </div>
                {k.delta && (
                  <div className="mt-1 text-[10px] font-medium" style={{ color: c.ink }}>
                    {k.delta}
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {/* ROW 1: 折线 + Top 标签 + 时段 */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] gap-3">
          <Card>
            <CardHead title="最近 7 天" titleEm="新增" sub="按创建时间" tight />
            <div className="relative h-[130px]">
              <svg viewBox="0 0 700 130" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="dashTrendG" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g stroke="currentColor" strokeWidth="1" className="text-[#E4EAF0] dark:text-[#262932]">
                  <line x1="0" y1="32" x2="700" y2="32" />
                  <line x1="0" y1="65" x2="700" y2="65" />
                  <line x1="0" y1="98" x2="700" y2="98" />
                </g>
                {chartPath.area && <path d={chartPath.area} fill="url(#dashTrendG)" />}
                {chartPath.line && <path d={chartPath.line} fill="none" stroke={PRIMARY} strokeWidth="2" />}
                {chartPath.points.map((p, i) => {
                  const isPeak = p.v === peak7 && peak7 > 0
                  return (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={isPeak ? 4.5 : 3} fill={PRIMARY} stroke={isDark ? '#16181D' : '#FFFFFF'} strokeWidth={isPeak ? 2 : 1.5} />
                      {isPeak && (
                        <text x={p.x} y={Math.max(p.y - 8, 12)} textAnchor="middle" fill={isDark ? '#F4F6FA' : '#0F1115'} fontFamily="ui-monospace,Menlo,monospace" fontSize="10" fontWeight="600">
                          {p.v}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>
            <div className="flex justify-between mt-1.5 font-mono text-[10px] text-gray-400 dark:text-gray-500 tracking-wider">
              {last7.map((d, i) => (<span key={i}>{d.date}</span>))}
            </div>
          </Card>

          <Card>
            <CardHead title="Top 5" titleEm="标签" tight />
            {top5Tags.length === 0 ? (
              <EmptyHint text="还没有标签" small />
            ) : (
              <div className="flex flex-col gap-1.5">
                {top5Tags.map((t, i) => {
                  const c = HI[tagColors[i]]
                  return (
                    <div key={t.name} className="flex items-center gap-2 text-[12px]">
                      <span className="font-medium px-2 py-0.5 rounded text-center flex-shrink-0 w-16 truncate text-[11px]" style={{ background: c.bg, color: c.ink }} title={t.name}>
                        #{t.name}
                      </span>
                      <span className="flex-1 h-1.5 bg-[#EEF2F6] dark:bg-[#1E2025] rounded-full overflow-hidden">
                        <span className="block h-full rounded-full" style={{ width: `${(t.count / tagMax) * 100}%`, background: c.main }} />
                      </span>
                      <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300 w-6 text-right tabular-nums">{t.count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="活跃" titleEm="时段" sub="24h" tight />
            <HoursBar hourly={stats.hourlyActivity} peakHour={peakHour.hour} />
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

        {/* ROW 2: 热力图 + 最近笔记 */}
        <section className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-3">
          <Card>
            <CardHead
              title="热力图"
              sub={`90 天 · ${activeInHeatmap} 天活跃`}
              chip={
                <div className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {[0, 1, 2, 3, 4].map((l) => (
                    <i key={l} className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: cellColor(l as 0 | 1 | 2 | 3 | 4) }} />
                  ))}
                </div>
              }
              tight
            />
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(13, 1fr)', gridTemplateRows: 'repeat(7, 1fr)' }}>
              {heatmap.map((cell, i) => (
                <span
                  key={i}
                  title={`${cell.date} · ${cell.count} 篇`}
                  className="aspect-square rounded-[3px] transition-transform hover:scale-125"
                  style={{ background: cellColor(cell.level) }}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHead
              title="最近笔记"
              sub="按编辑时间"
              chip={
                <button onClick={() => onNavigate('inbox')} className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-[#5E6AD2] dark:hover:text-[#7C83E0] transition-colors">
                  全部 →
                </button>
              }
              tight
            />
            {stats.recentNotes.length === 0 ? (
              <EmptyHint text="还没有笔记 — 点新建第一篇" small />
            ) : (
              <div className="flex flex-col">
                {stats.recentNotes.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className="grid grid-cols-[1fr_auto] gap-2 py-1.5 border-b border-[#EEF2F6] dark:border-[#1C1F26] last:border-0 first:pt-0 items-center cursor-pointer group"
                    onClick={() => onOpenNote(n.id)}
                    title="点击打开"
                  >
                    <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100 group-hover:text-[#5E6AD2] dark:group-hover:text-[#7C83E0] transition-colors line-clamp-1">
                      {n.title || '未命名笔记'}
                    </div>
                    <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap uppercase tracking-wider">
                      {relativeTime(n.updatedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}

/* ============ 子组件 ============ */

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

function HoursBar({ hourly, peakHour }: { hourly: { hour: string; count: number }[]; peakHour: number }) {
  const max = Math.max(...hourly.map((h) => h.count), 1)
  return (
    <div className="items-end gap-[2px] h-[88px] grid" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
      {hourly.map((h, i) => {
        const height = Math.max(4, (h.count / max) * 100)
        const isPeak = i === peakHour && h.count > 0
        return (
          <span
            key={i}
            title={`${i}:00 · ${h.count} 篇`}
            className="block rounded-t-sm transition-colors cursor-pointer"
            style={{
              height: `${height}%`,
              background: isPeak ? PRIMARY : 'rgba(94,106,210,.18)',
              boxShadow: isPeak ? `0 0 6px rgba(94,106,210,.4)` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
