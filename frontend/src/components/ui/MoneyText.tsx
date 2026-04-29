import { formatCurrency } from '../../lib/formatters'

interface MoneyTextProps {
  value: number | null | undefined
  className?: string
}

export function MoneyText({ value, className }: MoneyTextProps) {
  if (value == null) return <span className={className ?? 'text-gray-500'}>—</span>
  return <span className={className}>{formatCurrency(value)}</span>
}
