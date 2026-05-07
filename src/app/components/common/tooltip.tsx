import {
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useAnimatedPresence } from '../../hooks/useAnimatedPresence'
import { cn } from '../../utils/cn'

type TooltipProps = PropsWithChildren<
  HTMLAttributes<HTMLSpanElement> & {
    content: ReactNode
    placement?: 'top' | 'right' | 'left' | undefined
    className?: string | undefined
    contentClassName?: string | undefined
    delayMs?: number | undefined
  }
>

export function Tooltip({
  content,
  placement = 'top',
  className,
  contentClassName,
  delayMs = 0,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...anchorProps
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const present = useAnimatedPresence(open, 120)
  const tooltipId = useId()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)
  const openTimerRef = useRef<number | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  })
  const [positionReady, setPositionReady] = useState(false)

  const clearOpenTimer = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }

  const showTooltip = () => {
    clearOpenTimer()
    if (delayMs <= 0) {
      setOpen(true)
      return
    }

    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null
      setOpen(true)
    }, delayMs)
  }

  const hideTooltip = () => {
    clearOpenTimer()
    setOpen(false)
  }

  useEffect(() => {
    return () => {
      if (openTimerRef.current !== null) {
        window.clearTimeout(openTimerRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    if (!present) {
      setPositionReady(false)
      return
    }

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      const tooltipRect = contentRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }

      const viewportPadding = 12
      const tooltipWidth = tooltipRect?.width ?? 0
      const centeredLeft = rect.left + rect.width / 2
      const minCenteredLeft =
        tooltipWidth > 0 ? viewportPadding + tooltipWidth / 2 : viewportPadding
      const maxCenteredLeft =
        tooltipWidth > 0
          ? window.innerWidth - viewportPadding - tooltipWidth / 2
          : window.innerWidth - viewportPadding
      const left = (() => {
        if (placement === 'right') {
          return Math.min(window.innerWidth - viewportPadding - tooltipWidth, rect.right + 10)
        }
        if (placement === 'left') {
          return Math.max(viewportPadding + tooltipWidth, rect.left - 10)
        }

        return Math.min(maxCenteredLeft, Math.max(minCenteredLeft, centeredLeft))
      })()

      setPosition({
        left,
        top:
          placement === 'right' || placement === 'left' ? rect.top + rect.height / 2 : rect.top - 8,
      })
      setPositionReady(true)
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [present, placement])

  return (
    <span
      role="application"
      {...anchorProps}
      ref={anchorRef}
      className={cn('tooltip-anchor', className)}
      onMouseEnter={(event) => {
        onMouseEnter?.(event)
        showTooltip()
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event)
        hideTooltip()
      }}
      onFocus={(event) => {
        onFocus?.(event)
        showTooltip()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        hideTooltip()
      }}
      aria-describedby={open ? tooltipId : undefined}
    >
      {children}
      {present
        ? createPortal(
            <span
              ref={contentRef}
              id={tooltipId}
              role="tooltip"
              data-open={open ? 'true' : 'false'}
              data-placement={placement}
              data-ready={positionReady ? 'true' : 'false'}
              style={{ left: `${position.left}px`, top: `${position.top}px` }}
              className={cn('tooltip-content', contentClassName)}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
