/** `yyyy-MM-dd` no calendário local (não use `toISOString().slice(0,10)` — isso é UTC e muda o dia perto da meia-noite). */
export function formatLocalDateYmd(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Hoje no fuso local — padrão para `<input type="date" />` e filtros “hoje”. */
export function getLocalTodayYmd(): string {
  return formatLocalDateYmd(new Date())
}

/** Data local a N dias da hoje (negativo = passado). */
export function shiftLocalDaysFromToday(deltaDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + deltaDays)
  return formatLocalDateYmd(d)
}

/**
 * Converte `yyyy-MM-dd` do **calendário local** em instantes UTC para a API.
 * - `start`: início inclusivo (meia-noite local da data).
 * - `end`: **fim exclusivo** = meia-noite local do dia **seguinte** (CreatedAt &lt; este instante inclui o dia inteiro escolhido).
 * Assim uma cobrança criada “ainda hoje” no Brasil não some do período por cair no dia UTC seguinte.
 */
export function normalizeDateParamForApi(value: string, boundary: 'start' | 'end'): string {
  if (value.includes('T')) return value
  const [y, m, d] = value.split('-').map(Number)
  if (boundary === 'start')
    return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString()
}

/** Par `{ fromDate, toDate }` já normalizados para `params` do axios. */
export function normalizeDateRangeParamsForApi(fromDate?: string, toDate?: string) {
  const from = fromDate?.trim()
  const to = toDate?.trim()
  if (!from && !to) return {}
  const effFrom = from || to!
  const effTo = to || from!
  return {
    fromDate: normalizeDateParamForApi(effFrom, 'start'),
    toDate: normalizeDateParamForApi(effTo, 'end'),
  }
}
