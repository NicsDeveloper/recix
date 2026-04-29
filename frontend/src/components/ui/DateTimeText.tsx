import { formatDateTime } from '../../lib/formatters'

interface DateTimeTextProps {
  value: string | null | undefined
  className?: string
}

export function DateTimeText({ value, className }: DateTimeTextProps) {
  if (!value) return <span className={className ?? 'text-gray-500'}>—</span>
  return (
    <time dateTime={value} className={className}>
      {formatDateTime(value)}
    </time>
  )
}
