import { ResponsiveContainer, LineChart, Line } from 'recharts'

interface DashboardKpiCardProps {
  title: string
  value: string
  subtitle: string
  sparkValues: number[]
  lineColor: string
  trendPct: number | null
}

function fmtTrend(pct: number | null) {
  if (pct === null) return { text: '—', cls: 'text-gray-500', arrow: '' }
  if (Math.abs(pct) < 0.05) return { text: '0,0%', cls: 'text-gray-400', arrow: '= ' }
  const abs = Math.abs(pct).toFixed(1).replace('.', ',')
  if (pct > 0) return { text: `${abs}%`, cls: 'text-green-400', arrow: '↑ ' }
  return { text: `${abs}%`, cls: 'text-red-400', arrow: '↓ ' }
}

export function DashboardKpiCard({ title, value, subtitle, sparkValues, lineColor, trendPct }: DashboardKpiCardProps) {
  const data = sparkValues.map((v, i) => ({ i, v }))
  const trend = fmtTrend(trendPct)

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-400">{title}</p>
        <div className="w-[100px] h-[32px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Line type="natural" dataKey="v" stroke={lineColor} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-2xl font-black tabular-nums tracking-tight leading-none" style={{ color: lineColor }}>{value}</p>
        <p className="text-xs text-gray-500 mt-1.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        <span className={`font-semibold ${trend.cls}`}>{trend.arrow}{trend.text}</span>
        <span className="text-gray-600">vs período anterior</span>
      </div>
    </div>
  )
}
