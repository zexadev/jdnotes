import React, { useState } from 'react'

interface SidebarItemProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  active?: boolean
  count?: number
  collapsed?: boolean
  onClick?: () => void
}

export function SidebarItem({
  icon: Icon,
  label,
  active = false,
  count,
  collapsed = false,
  onClick,
}: SidebarItemProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => collapsed && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex w-full items-center rounded-lg text-[13px] transition-colors duration-150 btn-press ${
          collapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'
        } ${
          active
            ? 'bg-[#5E6AD2]/10 text-[#5E6AD2] font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/[0.02]'
        }`}
      >
        {active && !collapsed && <span className="w-[3px] h-4 bg-[#5E6AD2] rounded-full -ml-1 mr-1 flex-shrink-0" />}
        <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-[#5E6AD2]' : ''}`} strokeWidth={active ? 2 : 1.5} />
        {!collapsed && <span>{label}</span>}
        {!collapsed && count !== undefined && count > 0 && (
          <span className={`ml-auto text-[11px] tabular-nums ${active ? 'text-[#5E6AD2]/70' : 'text-slate-400 dark:text-slate-500'}`}>{count}</span>
        )}
      </button>

      {/* Tooltip for collapsed mode */}
      {collapsed && showTooltip && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[12px] rounded-md shadow-lg whitespace-nowrap pointer-events-none">
          {label}
          {count !== undefined && count > 0 && (
            <span className="ml-1.5 text-slate-300">({count})</span>
          )}
        </div>
      )}
    </div>
  )
}
