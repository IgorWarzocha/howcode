import { SkeletonBlock } from '../../components/common/skeleton'

export function ProjectMetric({
  detail,
  label,
  loading,
  value,
}: {
  detail: string
  label: string
  loading: boolean
  value: string
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <div className="text-[11px] font-medium tracking-[0.08em] text-[color:var(--muted)] uppercase">
        {label}
      </div>
      {loading ? (
        <>
          <SkeletonBlock className="h-[17px] w-20 rounded-md" />
          <SkeletonBlock className="h-3 w-[min(11rem,80%)] rounded-md opacity-60" />
        </>
      ) : (
        <>
          <div className="font-mono text-[17px] leading-none font-medium text-[color:var(--text)] tabular-nums">
            {value}
          </div>
          <div className="truncate text-[12px] text-[color:var(--muted-2)]">{detail}</div>
        </>
      )}
    </div>
  )
}
