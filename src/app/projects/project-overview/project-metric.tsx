import { SkeletonBlock } from '../../common/skeleton'
import {
  appToneMutedClass,
  appToneSubtleClass,
  appToneTextClass,
  appTypeDashboardLabelStrongClass,
  appTypeDashboardMetricClass,
  appTypeSmallClass,
} from '../../ui/classes'

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
      <div
        className={`${appTypeDashboardLabelStrongClass} tracking-[0.08em] ${appToneMutedClass} uppercase`}
      >
        {label}
      </div>
      {loading ? (
        <>
          <SkeletonBlock className="h-[17px] w-20 rounded-md" />
          <SkeletonBlock className="h-3 w-[min(11rem,80%)] rounded-md opacity-60" />
        </>
      ) : (
        <>
          <div className={`font-mono ${appTypeDashboardMetricClass} ${appToneTextClass}`}>
            {value}
          </div>
          <div className={`truncate ${appTypeSmallClass} ${appToneSubtleClass}`}>{detail}</div>
        </>
      )}
    </div>
  )
}
