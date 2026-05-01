import type { DashboardSummary } from '../types'

/** Valor em destaque no dashboard: cobranças divergentes ou exposição vinda das conciliações (ex.: pagamento sem cobrança). */
export function effectiveDivergenceAmount(s: DashboardSummary): number {
  const fromCharges = Number(s.totalDivergentAmount)
  const fromRecon = Number(s.totalReconciliationAttentionAmount ?? 0)
  return Math.max(fromCharges, fromRecon)
}
