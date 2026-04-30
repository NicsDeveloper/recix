import { http } from '../lib/http'
import type { ClosingReport, DashboardOverview, DashboardSummary } from '../types'

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    const { data } = await http.get<DashboardSummary>('/dashboard/summary')
    return data
  },

  async getOverview(params?: { fromDate?: string; toDate?: string }): Promise<DashboardOverview> {
    // Backend espera DateTime; inputs do tipo `date` chegam como `yyyy-MM-dd`.
    // Convertendo para ISO garante model binding consistente.
    const normalizedParams =
      params && (params.fromDate || params.toDate)
        ? {
            fromDate: params.fromDate ? normalizeDateParam(params.fromDate, 'start') : undefined,
            toDate: params.toDate ? normalizeDateParam(params.toDate, 'end') : undefined,
          }
        : undefined

    const { data } = await http.get<DashboardOverview>('/dashboard/overview', { params: normalizedParams })
    return data
  },

  async getClosingReport(params?: { fromDate?: string; toDate?: string }): Promise<ClosingReport> {
    const normalizedParams =
      params && (params.fromDate || params.toDate)
        ? {
            fromDate: params.fromDate ? normalizeDateParam(params.fromDate, 'start') : undefined,
            toDate: params.toDate ? normalizeDateParam(params.toDate, 'end') : undefined,
          }
        : undefined

    const { data } = await http.get<ClosingReport>('/dashboard/closing-report', { params: normalizedParams })
    return data
  },
}

function normalizeDateParam(value: string, boundary: 'start' | 'end') {
  // Se já vier com horário (ex.: ISO completo), não mexe.
  if (value.includes('T')) return value
  return boundary === 'start' ? `${value}T00:00:00Z` : `${value}T23:59:59Z`
}
