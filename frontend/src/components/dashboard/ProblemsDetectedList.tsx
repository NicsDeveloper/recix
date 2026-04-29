import type { ReactNode } from 'react'

export type ProblemsDetectedItem = {
  label: string
  description: string
  count: number
  percent: number
  color: string
  icon: ReactNode
}

interface ProblemsDetectedListProps {
  title: string
  total: number
  items: ProblemsDetectedItem[]
}

export function ProblemsDetectedList({ title, items }: ProblemsDetectedListProps) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 shadow-sm p-6 h-full flex flex-col">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 flex-shrink-0">{title}</h2>

      <div className="space-y-4 flex-1">
        {items.map((it) => (
          <div key={it.label} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
              {it.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{it.label}</p>
                  <p className="text-xs text-gray-300 mt-1">{it.description}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-gray-50">{it.count.toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-gray-400">
                    {it.percent.toFixed(1).replace('.', ',')}%
                  </div>
                </div>
              </div>

              <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, it.percent))}%`,
                    backgroundColor: it.color,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

