import { parseInlineChart } from './parse-inline-chart'

export function InlineChart({ source }: { source: string }) {
  const chart = parseInlineChart(source)
  if (!chart) return <p>Chart unavailable. Read the source below.</p>
  const low = Math.min(0, ...chart.data.map((row) => row.value))
  const high = Math.max(0, ...chart.data.map((row) => row.value))
  const range = high - low || 1
  const y = (value: number) => 180 - ((value - low) / range) * 150
  const step = 440 / chart.data.length
  return (
    <figure className="m-0 grid gap-2">
      <figcaption className="font-semibold">{chart.title}</figcaption>
      <svg
        viewBox="0 0 500 220"
        role="img"
        aria-label={`${chart.title}. Values available in Data below.`}
        className="h-auto max-h-[24rem] w-full text-[color:var(--text)]"
      >
        <title>{chart.title}</title>
        <line x1="40" x2="480" y1={y(0)} y2={y(0)} stroke="currentColor" opacity="0.4" />
        <text x="2" y="28" fill="currentColor" fontSize="11">
          {high}
        </text>
        <text x="2" y="185" fill="currentColor" fontSize="11">
          {low}
        </text>
        {chart.type === 'line' ? (
          <polyline
            points={chart.data
              .map((row, index) => `${40 + step * (index + 0.5)},${y(row.value)}`)
              .join(' ')}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        ) : null}
        {chart.data.map((row, index) => (
          <g key={row.label}>
            {chart.type === 'bar' ? (
              <rect
                x={40 + step * index + step * 0.15}
                y={Math.min(y(0), y(row.value))}
                width={step * 0.7}
                height={Math.max(1, Math.abs(y(row.value) - y(0)))}
                fill="var(--accent)"
              />
            ) : (
              <circle cx={40 + step * (index + 0.5)} cy={y(row.value)} r="3" fill="var(--accent)" />
            )}
            <title>{`${row.label}: ${row.value}`}</title>
            {chart.data.length <= 8 ? (
              <text
                x={40 + step * (index + 0.5)}
                y="205"
                textAnchor="middle"
                fill="currentColor"
                fontSize="11"
              >
                {row.label.slice(0, 14)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <details>
        <summary>Data</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {chart.data.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="pr-4 text-left font-normal">
                  {row.label}
                </th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
