import { sanitizeInlineSvg } from './sanitize-inline-svg'

const maxSourceLength = 8_000
const maxRenderTime = 3_000
const diagramStart =
  /^(?:flowchart|graph|sequenceDiagram|stateDiagram-v2|classDiagram|erDiagram|pie|timeline|journey)\b/
const unsafeSource =
  /%%\{|^\s*---|<\s*[a-z!/?]|&(?:#|[a-z]+;)|!\[|\b(?:click|href|image|img|src|icon|style|classDef|linkStyle|css|url|callback)\b|(?:https?|data|javascript):/im
const unsafePaint = /url\(|[<>]/i
const paintAttributes = [
  'fill',
  'stroke',
  'stroke-width',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'opacity',
]

let renderQueue: Promise<unknown> = Promise.resolve()
let timedOut = false
let nextId = 0

export function isSafeMermaidSource(source: string) {
  return (
    source.length <= maxSourceLength &&
    source.split('\n').length <= 120 &&
    diagramStart.test(source.trimStart()) &&
    !unsafeSource.test(source)
  )
}

function bakeSvgPaint(svg: SVGSVGElement) {
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    const computed = getComputedStyle(element)
    for (const attribute of paintAttributes) {
      const value = computed.getPropertyValue(attribute)
      // Only local marker/paint references may survive the final SVG sanitizer.
      if (value && !unsafePaint.test(value)) element.setAttribute(attribute, value)
    }
  }
}

async function renderDiagram(source: string, signal: AbortSignal) {
  if (signal.aborted || timedOut) throw new Error('Diagram rendering unavailable')
  const { default: mermaid } = await import('mermaid')
  if (signal.aborted) throw new Error('Diagram cancelled')
  const colors = getComputedStyle(document.documentElement)
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    htmlLabels: false,
    maxTextSize: maxSourceLength,
    maxEdges: 100,
    theme: 'base',
    themeVariables: {
      primaryColor: colors.getPropertyValue('--panel').trim() || '#202020',
      primaryTextColor: colors.getPropertyValue('--text').trim() || '#eeeeee',
      primaryBorderColor: colors.getPropertyValue('--muted').trim() || '#aaaaaa',
      lineColor: colors.getPropertyValue('--muted').trim() || '#aaaaaa',
      textColor: colors.getPropertyValue('--text').trim() || '#eeeeee',
      fontFamily: 'sans-serif',
    },
    flowchart: { htmlLabels: false },
  })
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none'
  document.body.append(container)
  let timer: ReturnType<typeof setTimeout> | undefined
  const started = performance.now()
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true
        reject(new Error('Diagram rendering timed out'))
      }, maxRenderTime)
    })
    const rendered = await Promise.race([
      mermaid.render(`howcode-mermaid-${++nextId}`, source, container),
      timeout,
    ])
    if (performance.now() - started > maxRenderTime) {
      timedOut = true
      throw new Error('Diagram rendering timed out')
    }
    if (signal.aborted) throw new Error('Diagram cancelled')
    if (rendered.svg.length > 100_000) throw new Error('Diagram too large')
    // Mermaid removes its temporary SVG before resolving. Its strict-mode result
    // is already DOMPurify-cleaned; reconnect it only to bake generated theme CSS.
    const parsed = new DOMParser().parseFromString(rendered.svg, 'image/svg+xml')
    if (parsed.querySelector('parsererror')) throw new Error('Invalid diagram SVG')
    const svg = document.importNode(parsed.documentElement, true)
    if (!(svg instanceof SVGSVGElement)) throw new Error('Invalid diagram SVG')
    container.append(svg)
    bakeSvgPaint(svg)
    const safeSvg = sanitizeInlineSvg(svg.outerHTML)
    if (!safeSvg) throw new Error('Diagram could not be sanitized')
    return safeSvg
  } finally {
    clearTimeout(timer)
    container.remove()
  }
}

export function renderMermaid(source: string, signal: AbortSignal): Promise<string> {
  if (!isSafeMermaidSource(source)) return Promise.reject(new Error('Unsupported diagram source'))
  // Mermaid configuration and DOM layout are global; never interleave renders.
  const result = renderQueue.then(() => renderDiagram(source, signal))
  renderQueue = result.catch(() => undefined)
  return result
}
