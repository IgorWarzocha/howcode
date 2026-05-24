import { appToneAccentClass, appTypeLogoMarkClass } from '../ui/classes'
import { cn } from '../utils/cn'

type HowcodeLogoMarkProps = {
  className?: string
}

export function HowcodeLogoMark({ className }: HowcodeLogoMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        appTypeLogoMarkClass,
        appToneAccentClass,
        className,
      )}
    >
      H
    </span>
  )
}
