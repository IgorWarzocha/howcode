type TypographyToken = {
  size: string
  lineHeight?: string
}

export const appTypographyTokens = {
  viewTitle: { size: '18px' },
  sectionTitle: { size: '15px' },
  body: { size: '14px', lineHeight: '1.5' },
  bodyComfortable: { size: '14px', lineHeight: '1.7' },
  group: { size: '13px', lineHeight: '1.25rem' },
  control: { size: '12.5px', lineHeight: '1.25rem' },
  small: { size: '12px', lineHeight: '1rem' },
  smallComfortable: { size: '12px', lineHeight: '1.2rem' },
  meta: { size: '11px', lineHeight: '1rem' },
  tooltip: { size: '11.5px', lineHeight: '1rem' },
  tiny: { size: '10.5px', lineHeight: '1rem' },
  kicker: { size: '9px', lineHeight: '1' },
  sidebarTitle: { size: '13.5px', lineHeight: '1.25rem' },
  code: { size: '11.5px', lineHeight: '1.25rem' },
  codeBlock: { size: '12.5px', lineHeight: '1.5rem' },
  readable: { size: '14px', lineHeight: '1.68' },
  heroTitle: { size: 'clamp(36px,6vw,56px)', lineHeight: '1.25' },
  dashboardTitle: { size: '24px', lineHeight: '1.25' },
  dashboardMetric: { size: '18px', lineHeight: '1.25' },
  dashboardLabel: { size: '12px', lineHeight: '1rem' },
} as const satisfies Record<string, TypographyToken>

type TypographyTokenName = keyof typeof appTypographyTokens

type TypographyCssVarName = `--app-type-${string}-size` | `--app-type-${string}-line-height`

const tokenCssVars: Record<
  TypographyTokenName,
  { size: TypographyCssVarName; lineHeight?: TypographyCssVarName }
> = {
  viewTitle: { size: '--app-type-view-title-size' },
  sectionTitle: { size: '--app-type-section-title-size' },
  body: { size: '--app-type-body-size', lineHeight: '--app-type-body-line-height' },
  bodyComfortable: {
    size: '--app-type-body-size',
    lineHeight: '--app-type-body-comfortable-line-height',
  },
  group: { size: '--app-type-group-size', lineHeight: '--app-type-group-line-height' },
  control: { size: '--app-type-control-size', lineHeight: '--app-type-control-line-height' },
  small: { size: '--app-type-small-size', lineHeight: '--app-type-small-line-height' },
  smallComfortable: {
    size: '--app-type-small-size',
    lineHeight: '--app-type-small-comfortable-line-height',
  },
  meta: { size: '--app-type-meta-size', lineHeight: '--app-type-meta-line-height' },
  tooltip: { size: '--app-type-tooltip-size', lineHeight: '--app-type-tooltip-line-height' },
  tiny: { size: '--app-type-tiny-size', lineHeight: '--app-type-tiny-line-height' },
  kicker: { size: '--app-type-kicker-size', lineHeight: '--app-type-kicker-line-height' },
  sidebarTitle: {
    size: '--app-type-sidebar-title-size',
    lineHeight: '--app-type-sidebar-title-line-height',
  },
  code: { size: '--app-type-code-size', lineHeight: '--app-type-code-line-height' },
  codeBlock: {
    size: '--app-type-code-block-size',
    lineHeight: '--app-type-code-block-line-height',
  },
  readable: { size: '--app-type-readable-size', lineHeight: '--app-type-readable-line-height' },
  heroTitle: {
    size: '--app-type-hero-title-size',
    lineHeight: '--app-type-hero-title-line-height',
  },
  dashboardTitle: {
    size: '--app-type-dashboard-title-size',
    lineHeight: '--app-type-dashboard-title-line-height',
  },
  dashboardMetric: {
    size: '--app-type-dashboard-metric-size',
    lineHeight: '--app-type-dashboard-metric-line-height',
  },
  dashboardLabel: {
    size: '--app-type-dashboard-label-size',
    lineHeight: '--app-type-dashboard-label-line-height',
  },
}

export function getTypographyCssVariables() {
  const entries: [TypographyCssVarName, string][] = []
  const seen = new Set<TypographyCssVarName>()

  for (const [name, token] of Object.entries(appTypographyTokens) as [
    TypographyTokenName,
    TypographyToken,
  ][]) {
    const vars = tokenCssVars[name]
    if (!seen.has(vars.size)) {
      entries.push([vars.size, token.size])
      seen.add(vars.size)
    }
    if (vars.lineHeight && token.lineHeight && !seen.has(vars.lineHeight)) {
      entries.push([vars.lineHeight, token.lineHeight])
      seen.add(vars.lineHeight)
    }
  }

  return entries
}

// Keep these as complete literal Tailwind classes. Tailwind scans source as text and will not
// generate CSS for utilities assembled from pieces like `text-[length:var(${name})]`.
const tokenClasses: Record<TypographyTokenName, string> = {
  viewTitle: 'text-[length:var(--app-type-view-title-size)]',
  sectionTitle: 'text-[length:var(--app-type-section-title-size)]',
  body: 'text-[length:var(--app-type-body-size)] leading-[var(--app-type-body-line-height)]',
  bodyComfortable:
    'text-[length:var(--app-type-body-size)] leading-[var(--app-type-body-comfortable-line-height)]',
  group: 'text-[length:var(--app-type-group-size)] leading-[var(--app-type-group-line-height)]',
  control:
    'text-[length:var(--app-type-control-size)] leading-[var(--app-type-control-line-height)]',
  small: 'text-[length:var(--app-type-small-size)] leading-[var(--app-type-small-line-height)]',
  smallComfortable:
    'text-[length:var(--app-type-small-size)] leading-[var(--app-type-small-comfortable-line-height)]',
  meta: 'text-[length:var(--app-type-meta-size)] leading-[var(--app-type-meta-line-height)]',
  tooltip:
    'text-[length:var(--app-type-tooltip-size)] leading-[var(--app-type-tooltip-line-height)]',
  tiny: 'text-[length:var(--app-type-tiny-size)] leading-[var(--app-type-tiny-line-height)]',
  kicker: 'text-[length:var(--app-type-kicker-size)] leading-[var(--app-type-kicker-line-height)]',
  sidebarTitle:
    'text-[length:var(--app-type-sidebar-title-size)] leading-[var(--app-type-sidebar-title-line-height)]',
  code: 'text-[length:var(--app-type-code-size)] leading-[var(--app-type-code-line-height)]',
  codeBlock:
    'text-[length:var(--app-type-code-block-size)] leading-[var(--app-type-code-block-line-height)]',
  readable:
    'text-[length:var(--app-type-readable-size)] leading-[var(--app-type-readable-line-height)]',
  heroTitle:
    'text-[length:var(--app-type-hero-title-size)] leading-[var(--app-type-hero-title-line-height)]',
  dashboardTitle:
    'text-[length:var(--app-type-dashboard-title-size)] leading-[var(--app-type-dashboard-title-line-height)]',
  dashboardMetric:
    'text-[length:var(--app-type-dashboard-metric-size)] leading-[var(--app-type-dashboard-metric-line-height)]',
  dashboardLabel:
    'text-[length:var(--app-type-dashboard-label-size)] leading-[var(--app-type-dashboard-label-line-height)]',
}

function typeClass(name: TypographyTokenName) {
  return tokenClasses[name]
}

export const appTypeViewTitleClass = `${typeClass('viewTitle')} font-medium`
export const appTypeSectionTitleClass = `${typeClass('sectionTitle')} font-medium`
export const appTypeGroupTitleClass = `${typeClass('group')} font-medium`
export const appTypeLogoMarkClass = `${appTypeGroupTitleClass} leading-none`
export const appTypeGroupTextClass = typeClass('group')
export const appTypeBodyClass = typeClass('bodyComfortable')
export const appTypeReadableClass = typeClass('readable')
export const appTypeControlClass = typeClass('control')
export const appTypeControlNormalClass = `${appTypeControlClass} font-normal`
export const appTypeControlStrongClass = `${appTypeControlClass} font-medium`
export const appTypeSmallClass = typeClass('smallComfortable')
export const appTypeSmallStrongClass = `${appTypeSmallClass} font-medium`
export const appTypeMetaClass = typeClass('meta')
export const appTypeTinyClass = typeClass('tiny')
export const appTypeTinyStrongClass = `${appTypeTinyClass} font-medium`
export const appTypeKickerClass = `${typeClass('kicker')} tracking-[0.035em] uppercase`
export const appTypeCodeClass = `font-mono ${typeClass('code')}`
export const appTypeCodeBlockClass = `font-mono ${typeClass('codeBlock')}`
export const appTypeMetaStrongClass = `${appTypeMetaClass} font-medium`
export const appTypeReadableStrongClass = `${appTypeReadableClass} font-semibold`
export const appTypeHeroTitleClass = `${typeClass('heroTitle')} font-medium`
export const appTypeDashboardTitleClass = `${typeClass('dashboardTitle')} font-medium`
export const appTypeDashboardMetricClass = `${typeClass('dashboardMetric')} font-medium tabular-nums`
export const appTypeDashboardLabelClass = typeClass('dashboardLabel')
export const appTypeDashboardLabelStrongClass = `${appTypeDashboardLabelClass} font-medium`

export const appToneTextClass = 'text-[color:var(--text)]'
export const appToneMutedClass = 'text-[color:var(--muted)]'
export const appToneSubtleClass = 'text-[color:var(--muted-2)]/85'
export const appToneDangerClass = 'text-[color:var(--danger)]'
export const appToneAccentClass = 'text-[color:var(--accent)]'
