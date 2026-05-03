import { http } from '../lib/http'
import { normalizeDateRangeParamsForApi } from '../lib/dateRangeParam'
import type { ChargeReconciliationSummary, ClosingReport, DashboardOverview, DashboardSummary, PagedResult } from '../types'

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    const { data } = await http.get<DashboardSummary>('/dashboard/summary')
    return data
  },

  async getOverview(params?: { fromDate?: string; toDate?: string }): Promise<DashboardOverview> {
    const from = params?.fromDate?.trim()
    const to = params?.toDate?.trim()
    const normalizedParams =
      from || to ? normalizeDateRangeParamsForApi(from, to) : undefined

    const { data } = await http.get<DashboardOverview>('/dashboard/overview', { params: normalizedParams })
    return data
  },

  async getChargeReconciliationSummaries(params?: {
    fromDate?: string
    toDate?: string
    page?: number
    pageSize?: number
  }): Promise<PagedResult<ChargeReconciliationSummary>> {
    const from = params?.fromDate?.trim()
    const to = params?.toDate?.trim()
    const normalizedParams =
      from || to
        ? { ...normalizeDateRangeParamsForApi(from, to), page: params?.page, pageSize: params?.pageSize }
        : { page: params?.page, pageSize: params?.pageSize }

    const { data } = await http.get<PagedResult<ChargeReconciliationSummary>>(
      '/dashboard/charge-reconciliation-summaries',
      { params: normalizedParams },
    )
    return data
  },

  async getClosingReport(params?: { fromDate?: string; toDate?: string }): Promise<ClosingReport> {
    const from = params?.fromDate?.trim()
    const to = params?.toDate?.trim()
    const normalizedParams =
      from || to ? normalizeDateRangeParamsForApi(from, to) : undefined

    const { data } = await http.get<ClosingReport>('/dashboard/closing-report', { params: normalizedParams })
    return data
  },
}
