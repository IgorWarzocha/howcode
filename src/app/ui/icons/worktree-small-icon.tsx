import type { SVGProps } from 'react'

type WorktreeSmallIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string
}

export function WorktreeSmallIcon({
  size = 14,
  color = 'currentColor',
  strokeWidth = 2,
  ...props
}: WorktreeSmallIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="7" cy="5" r="3" />
      <circle cx="7" cy="19" r="3" />
      <circle cx="18" cy="10" r="3" />
      <path d="M7 8v8" />
      <path d="M7 16h2" />
      <path d="M12 15h.01" />
    </svg>
  )
}
