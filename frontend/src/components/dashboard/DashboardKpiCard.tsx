import { ResponsiveContainer, LineChart, Line } from 'recharts'
import type { ReactNode } from 'react'

type Trend = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

interface DashboardKpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  trend: Trend
  sparkValues: number[] // valores normalizados/compatíveis com escala do gráfico
  valueClassName?: string
}

const trendStyle: Record<Trend, { iconBg: string; iconFg: string; line: string; lineStroke: string }> = {
  success: {
    iconBg: 'bg-green-500/10',
    iconFg: 'text-green-400',
    line: '#22C55E',
    lineStroke: 'rgba(34,197,94,0.25)',
  },
  warning: {
    iconBg: 'bg-amber-500/10',
    iconFg: 'text-amber-400',
    line: '#F59E0B',
    lineStroke: 'rgba(245,158,11,0.25)',
  },
  danger: {
    iconBg: 'bg-red-500/10',
    iconFg: 'text-red-400',
    line: '#EF4444',
    lineStroke: 'rgba(239,68,68,0.25)',
  },
  neutral: {
    iconBg: 'bg-gray-500/10',
    iconFg: 'text-gray-200',
    line: '#6B7280',
    lineStroke: 'rgba(107,114,128,0.25)',
  },
  info: {
    iconBg: 'bg-sky-500/10',
    iconFg: 'text-sky-400',
    line: '#38BDF8',
    lineStroke: 'rgba(56,189,248,0.25)',
  },
}

export function DashboardKpiCard({ title, value, subtitle, icon, trend, sparkValues, valueClassName }: DashboardKpiCardProps) {
  const s = trendStyle[trend]
  const data = sparkValues.map((v, i) => ({ i, v }))

  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-800 shadow-sm p-5 flex flex-col gap-4 h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-400 truncate">{title}</p>
        </div>
        <div className={`p-2 rounded-lg ${s.iconBg}`}>
          <div className={s.iconFg}>{icon}</div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-2xl font-black tabular-nums tracking-tight leading-tight ${valueClassName ?? 'text-gray-50'}`}>{value}</div>
          {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
        </div>
        <div className="w-[110px] h-[34px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={s.line}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

