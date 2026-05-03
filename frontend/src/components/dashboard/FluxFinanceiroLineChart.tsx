import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts'
import { Info, ChevronDown } from 'lucide-react'
import type { FluxPoint, DashboardSummary } from '../../types'
import { formatCurrency } from '../../lib/formatters'
import { effectiveDivergenceAmount } from '../../lib/dashboardSummary'

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="bg-gray-900 border border-gray-700 shadow-xl rounded-xl px-3 py-2.5">
      <p className="text-xs font-semibold text-gray-200 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map(p => (
          <div key={p.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="text-gray-400">{p.name}</span>
            <span className="font-bold tabular-nums" style={{ color: p.color }}>{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const PERIODS = ['Por hora', 'Por dia', 'Por semana']

export function FluxFinanceiroLineChart({ fluxSeries, summary }: {
  fluxSeries: FluxPoint[]
  summary: DashboardSummary
}) {
  const [period, setPeriod]   = useState('Por hora')
  const [open,   setOpen]     = useState(false)
  const divTotal = effectiveDivergenceAmount(summary)
  const expectedTotal = Number(summary.totalExpectedAmount ?? 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-gray-200">Fluxo financeiro no período</h2>
          <Info size={13} className="text-gray-600" />
        </div>
        {/* Period selector */}
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {period} <ChevronDown size={12} />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 w-28 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-10 overflow-hidden">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${p === period ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        {[
          { label: 'Recebido',   color: '#22c55e' },
          { label: 'Esperado',   color: '#3b82f6' },
          { label: 'Divergente', color: '#ef4444' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-gray-400">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1" style={{ minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={fluxSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} width={55}
              tickFormatter={v => typeof v === 'number' ? (v >= 1000 ? `${v / 1000}k` : String(v)) : v} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="natural" dataKey="received"  name="Recebido"   stroke="#22c55e" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="natural" dataKey="expected"  name="Esperado"   stroke="#3b82f6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="natural" dataKey="divergent" name="Divergente" stroke="#ef4444" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-800">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Recebido</p>
          <p className="text-sm font-bold text-green-400 tabular-nums">{formatCurrency(summary.totalReceivedAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Esperado</p>
          <p className="text-sm font-bold text-blue-400 tabular-nums">{formatCurrency(expectedTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Divergente</p>
          <p className="text-sm font-bold text-red-400 tabular-nums">{formatCurrency(divTotal)}</p>
        </div>
      </div>
    </div>
  )
}
