import { appToneAccentClass, appTypeLogoMarkClass } from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'

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
