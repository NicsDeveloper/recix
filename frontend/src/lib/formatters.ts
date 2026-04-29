const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

const dateOnlyFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return dateTimeFormatter.format(new Date(value))
  } catch {
    return value
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return dateOnlyFormatter.format(new Date(value))
  } catch {
    return value
  }
}

export function truncate(value: string, maxLength = 24): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}…`
}
