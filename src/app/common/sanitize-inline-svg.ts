const svgTags = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
  'defs',
  'marker',
  'clipPath',
])
const svgAttributes = new Set([
  'xmlns',
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'transform',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'id',
  'marker-start',
  'marker-mid',
  'marker-end',
  'markerWidth',
  'markerHeight',
  'refX',
  'refY',
  'orient',
  'markerUnits',
  'clip-path',
])
const localPaintPattern = /^url\(#[A-Za-z_][\w:.-]*\)$/
const unsafeValuePattern = /url\s*\(|javascript:|data:|https?:|[<>]/i
const svgNamespace = 'http://www.w3.org/2000/svg'
const xmlDeclarationPattern = /<!DOCTYPE|<!ENTITY/i

function isSafeSvgAttribute(attribute: Attr) {
  return (
    svgAttributes.has(attribute.name) &&
    (attribute.name === 'xmlns' ||
      !unsafeValuePattern.test(attribute.value) ||
      localPaintPattern.test(attribute.value))
  )
}

/** Display-only SVG. Resource and execution elements never survive into the image. */
export function sanitizeInlineSvg(source: string): string | null {
  if (source.length > 100_000 || xmlDeclarationPattern.test(source)) return null
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = document.documentElement
  if (
    document.querySelector('parsererror') ||
    root.localName !== 'svg' ||
    root.namespaceURI !== svgNamespace
  )
    return null
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (!svgTags.has(element.localName) || element.namespaceURI !== svgNamespace) {
      element.remove()
      continue
    }
    for (const attribute of [...element.attributes]) {
      if (!isSafeSvgAttribute(attribute)) {
        element.removeAttributeNode(attribute)
      }
    }
  }
  root.setAttribute('xmlns', svgNamespace)
  root.setAttribute('font-family', 'Inter, sans-serif')
  // Defaults remain legible in both themes. The image cannot inherit host CSS.
  if (!root.hasAttribute('fill')) root.setAttribute('fill', '#737373')
  return new XMLSerializer().serializeToString(root)
}
