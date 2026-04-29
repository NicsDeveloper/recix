import type { ReactNode } from 'react'

type Trend = 'success' | 'warning' | 'danger' | 'neutral'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: Trend
}

const trendColors: Record<Trend, string> = {
  success: 'text-green-400',
  warning: 'text-yellow-400',
  danger: 'text-red-400',
  neutral: 'text-gray-400',
}

const trendIconBg: Record<Trend, string> = {
  success: 'bg-green-500/10 text-green-400',
  warning: 'bg-yellow-500/10 text-yellow-400',
  danger: 'bg-red-500/10 text-red-400',
  neutral: 'bg-gray-500/10 text-gray-400',
}

export function StatCard({ title, value, subtitle, icon, trend = 'neutral' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-400">{title}</p>
        {icon && (
          <span className={`p-2 rounded-lg ${trendIconBg[trend]}`}>
            {icon}
          </span>
        )}
      </div>
      <div>
        <p className={`text-2xl font-bold ${trendColors[trend]}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}
