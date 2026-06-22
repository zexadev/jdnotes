interface BrandLockupProps {
  /** 是否显示「Lapis」字标；侧栏收起时只留图标 */
  showName?: boolean
}

/** 品牌标识：图标 + 字标合为一体的 lockup（左上角品牌展示）。
 *  既用于贯穿到顶的品牌格，也用于侧栏隐藏时回落到顶栏最左。 */
export function BrandLockup({ showName = true }: BrandLockupProps) {
  return (
    <div
      data-tauri-drag-region
      className={`flex items-center h-full overflow-hidden ${
        showName ? 'gap-2 px-4' : 'w-full justify-center'
      }`}
    >
      <img
        src="/app-icon.png"
        alt="Lapis"
        className="h-5 w-5 rounded-md pointer-events-none flex-shrink-0"
        draggable={false}
      />
      {showName && (
        <span
          data-tauri-drag-region
          className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 tracking-[-0.01em] leading-none whitespace-nowrap"
        >
          Lapis
        </span>
      )}
    </div>
  )
}
