import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import type { FluxPoint, DashboardSummary } from '../../types'
import { formatCurrency } from '../../lib/formatters'

type FluxFinanceiroLineChartProps = {
  fluxSeries: FluxPoint[]
  summary: DashboardSummary
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null

  return (
    <div className="bg-gray-900 border border-gray-800 shadow-sm rounded-lg px-3 py-2">
      <div className="text-xs font-semibold text-gray-200">{label}</div>
      <div className="mt-2 space-y-1">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="text-gray-300">{p.name}</span>
            <span className="font-semibold" style={{ color: p.color }}>
              {formatCurrency(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FluxFinanceiroLineChart({ fluxSeries, summary }: FluxFinanceiroLineChartProps) {
  const expectedTotal = summary.totalReceivedAmount - summary.totalDivergentAmount

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Fluxo Financeiro</h2>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={fluxSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-700)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-gray-500)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--color-gray-500)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={60}
              tickFormatter={(v) => (typeof v === 'number' ? '' + v : v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="received"
              name="Recebido"
              stroke="#22C55E"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="expected"
              name="Esperado"
              stroke="#3B82F6"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="divergent"
              name="Divergente"
              stroke="#EF4444"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="min-w-0">
          <div className="text-xs text-gray-400">Recebido</div>
          <div className="text-sm font-semibold text-gray-50">{formatCurrency(summary.totalReceivedAmount)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-400">Esperado</div>
          <div className="text-sm font-semibold text-gray-50">{formatCurrency(expectedTotal)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-400">Divergente</div>
          <div className="text-sm font-semibold text-gray-50">{formatCurrency(summary.totalDivergentAmount)}</div>
        </div>
      </div>
    </div>
  )
}

