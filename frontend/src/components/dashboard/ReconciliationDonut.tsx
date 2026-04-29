import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

type DonutItem = {
  key: string
  label: string
  value: number
  color: string
  dotColor: string
}

interface ReconciliationDonutProps {
  total: number
  centerLabel?: string
  items: DonutItem[]
  legendIcon?: ReactNode
  viewAllTo: string
}

export function ReconciliationDonut({
  total,
  centerLabel = 'Total',
  items,
  viewAllTo,
}: ReconciliationDonutProps) {
  const chartData = items.filter((i) => i.value > 0)

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">{'Visão Geral de Conciliações'}</h2>

      <div className="flex items-start gap-6">
        <div className="relative w-[160px] h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="label"
                innerRadius={62}
                outerRadius={78}
                paddingAngle={2}
                stroke="none"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-xl font-bold text-gray-50 leading-none">
              {total.toLocaleString('pt-BR')}
            </div>
            <div className="text-sm font-semibold text-gray-400 mt-1">{centerLabel}</div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="grid gap-3">
            {chartData.length === 0 ? (
              <div className="text-sm text-gray-500">Sem dados de conciliação no período selecionado.</div>
            ) : (
              chartData.map((it) => (
                <div key={it.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: it.color }}
                    />
                    <span className="text-sm text-gray-200 truncate">{it.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400">{it.value.toLocaleString('pt-BR')}</span>
                </div>
              ))
            )}
          </div>

          <div className="mt-6">
            <Link
              to={viewAllTo}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Ver todas as conciliações <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

