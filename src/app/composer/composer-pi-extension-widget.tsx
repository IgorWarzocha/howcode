import type { PiExtensionWidget } from '../desktop/types'
import { appTypeCompactWidgetClass, piExtensionTextClass } from '../ui/classes'
import { cn } from '../utils/cn'

const piExtensionStyleMarkerOpen = '\u001b]howcode-style;'
const piExtensionStyleMarkerClose = '\u0007'
const piExtensionBoxGlyphPattern = /([╭╰│─]+)/gu

export function PiExtensionWidgetLines({ widget }: { widget: PiExtensionWidget }) {
  const lineCounts = new Map<string, number>()
  const boxedByExtension = widget.lines.some((line) =>
    stripPiExtensionStyleMarkers(line).trimStart().startsWith('╭'),
  )

  if (boxedByExtension) {
    return (
      <pre
        className={cn(
          'm-0 block max-w-full min-w-0 overflow-hidden truncate whitespace-pre text-[11.5px] leading-[1rem] text-[color:var(--muted-2)]/88',
          piExtensionTextClass,
        )}
      >
        {renderPiExtensionWidgetLine(widget.lines.join('\n'), { monoBoxGlyphs: false })}
      </pre>
    )
  }

  return widget.lines.map((line) => {
    const count = lineCounts.get(line) ?? 0
    lineCounts.set(line, count + 1)
    return (
      <div
        key={`${widget.key}:${count}:${line}`}
        className={cn(
          'min-w-0 truncate whitespace-pre text-[color:var(--muted-2)]/88',
          appTypeCompactWidgetClass,
        )}
      >
        {renderPiExtensionWidgetLine(line)}
      </div>
    )
  })
}

function stripPiExtensionStyleMarkers(line: string) {
  let output = ''
  let cursor = 0
  while (cursor < line.length) {
    const markerStart = line.indexOf(piExtensionStyleMarkerOpen, cursor)
    if (markerStart < 0) return output + line.slice(cursor)
    output += line.slice(cursor, markerStart)
    const valueStart = markerStart + piExtensionStyleMarkerOpen.length
    const markerEnd = line.indexOf(piExtensionStyleMarkerClose, valueStart)
    if (markerEnd < 0) return output + line.slice(markerStart)
    cursor = markerEnd + piExtensionStyleMarkerClose.length
  }
  return output
}

function renderPiExtensionWidgetLine(
  line: string,
  options: { monoBoxGlyphs: boolean } = { monoBoxGlyphs: true },
) {
  const segments: Array<{ className?: string | undefined; text: string }> = []
  let cursor = 0
  let className: string | undefined

  while (cursor < line.length) {
    const markerStart = line.indexOf(piExtensionStyleMarkerOpen, cursor)
    if (markerStart < 0) break
    if (markerStart > cursor) segments.push({ className, text: line.slice(cursor, markerStart) })
    const valueStart = markerStart + piExtensionStyleMarkerOpen.length
    const markerEnd = line.indexOf(piExtensionStyleMarkerClose, valueStart)
    if (markerEnd < 0) break
    className = getPiExtensionStyleClass(line.slice(valueStart, markerEnd))
    cursor = markerEnd + piExtensionStyleMarkerClose.length
  }

  if (cursor < line.length) segments.push({ className, text: line.slice(cursor) })
  if (segments.length === 0) return line

  const segmentCounts = new Map<string, number>()
  return segments.flatMap((segment) => {
    const keyBase = `${segment.className ?? 'plain'}:${segment.text}`
    const count = segmentCounts.get(keyBase) ?? 0
    segmentCounts.set(keyBase, count + 1)
    return renderPiExtensionWidgetSegment(segment, `${count}:${keyBase}`, options)
  })
}

function renderPiExtensionWidgetSegment(
  segment: { className?: string | undefined; text: string },
  keyPrefix: string,
  options: { monoBoxGlyphs: boolean },
) {
  const parts = segment.text.split(piExtensionBoxGlyphPattern)
  const partCounts = new Map<string, number>()
  return parts.map((part) => {
    const count = partCounts.get(part) ?? 0
    partCounts.set(part, count + 1)
    const isBoxGlyph = piExtensionBoxGlyphPattern.test(part)
    piExtensionBoxGlyphPattern.lastIndex = 0
    return (
      <span
        key={`${keyPrefix}:${count}:${part}`}
        className={cn(segment.className, options.monoBoxGlyphs && isBoxGlyph && 'font-mono')}
      >
        {part}
      </span>
    )
  })
}

function getPiExtensionStyleClass(marker: string) {
  if (marker === 'reset') return undefined
  if (marker === 'bold:bold') return 'font-medium text-[color:var(--text)]'
  const [kind, name] = marker.split(':')
  if (kind === 'bg') return getPiExtensionBgClass(name)
  if (kind === 'fg') return getPiExtensionFgClass(name)
  return undefined
}

function getPiExtensionFgClass(name: string | undefined) {
  switch (name) {
    case 'accent':
    case 'toolTitle':
    case 'customMessageLabel':
      return 'text-[color:var(--accent)]'
    case 'success':
      return 'text-[color:var(--success,var(--accent))]'
    case 'warning':
      return 'text-[color:var(--warning)]'
    case 'error':
      return 'text-[color:var(--danger)]'
    case 'text':
    case 'customMessageText':
      return 'text-[color:var(--text)]'
    case 'dim':
      return 'text-[color:var(--muted-2)]/70'
    case 'muted':
      return 'text-[color:var(--muted)]/88'
    default:
      return undefined
  }
}

function getPiExtensionBgClass(name: string | undefined) {
  switch (name) {
    case 'selectedBg':
    case 'customMessageBg':
      return 'bg-[color:var(--surface-hover)] text-[color:var(--text)]'
    default:
      return undefined
  }
}
