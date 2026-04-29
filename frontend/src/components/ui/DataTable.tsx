import type { ReactNode } from 'react'
import { LoadingState } from './LoadingState'
import { EmptyState } from './EmptyState'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  emptyIcon?: ReactNode
  onRowClick?: (row: T) => void
  keyExtractor?: (row: T) => string
  rowClassName?: (row: T) => string | undefined
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = 'Nenhum item encontrado.',
  emptyIcon,
  onRowClick,
  keyExtractor,
  rowClassName,
}: DataTableProps<T>) {
  if (isLoading) return <LoadingState />

  if (!data.length) {
    return <EmptyState message={emptyMessage} icon={emptyIcon} />
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {data.map((row, index) => {
            const key = keyExtractor ? keyExtractor(row) : String(index)
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  'bg-gray-900 transition-colors',
                  rowClassName?.(row) ?? '',
                  onRowClick ? 'cursor-pointer hover:bg-gray-800/60' : '',
                ].join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 text-gray-300 ${col.className ?? ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
