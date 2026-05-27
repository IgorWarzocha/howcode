import type { ReactNode } from 'react'
import {
  appToneAccentClass,
  appToneMutedClass,
  appTypeHeroTitleClass,
  appTypeTinyClass,
} from '../ui/classes'
import { cn } from '../utils/cn'

type PageIntroProps = {
  eyebrow: string
  title: ReactNode
  description: string
}

export function PageIntro({ eyebrow, title, description }: PageIntroProps) {
  return (
    <div>
      <span className={cn('uppercase tracking-[0.12em]', appTypeTinyClass, appToneMutedClass)}>
        {eyebrow}
      </span>
      <h1 className={cn('m-0', appTypeHeroTitleClass, appToneAccentClass)}>{title}</h1>
      <p className={cn('max-w-[720px] whitespace-normal', appToneMutedClass)}>{description}</p>
    </div>
  )
}
