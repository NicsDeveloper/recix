import { http } from '../lib/http'
import type { PagedResult, ReconciliationListParams, ReconciliationResult, RecentReconciliation, PendingReviewList } from '../types'

export interface EnrichedReconciliationParams {
  status?: string
  divergentOnly?: boolean
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

export const reconciliationsService = {
  async list(params: ReconciliationListParams = {}): Promise<PagedResult<ReconciliationResult>> {
    const { data } = await http.get<PagedResult<ReconciliationResult>>('/reconciliations', {
      params: { pageSize: 100, ...params },
    })
    return data
  },

  async listEnriched(params: EnrichedReconciliationParams = {}): Promise<PagedResult<RecentReconciliation>> {
    const normalized: Record<string, unknown> = { pageSize: 20, ...params }
    if (params.fromDate && !params.fromDate.includes('T')) normalized.fromDate = `${params.fromDate}T00:00:00Z`
    if (params.toDate   && !params.toDate.includes('T'))   normalized.toDate   = `${params.toDate}T23:59:59Z`
    const { data } = await http.get<PagedResult<RecentReconciliation>>('/reconciliations/enriched', { params: normalized })
    return data
  },

  async getPendingReview(): Promise<PendingReviewList> {
    const { data } = await http.get<PendingReviewList>('/reconciliations/pending-review')
    return data
  },

  async confirmMatch(id: string): Promise<void> {
    await http.post(`/reconciliations/${id}/confirm`)
  },

  async rejectMatch(id: string): Promise<void> {
    await http.post(`/reconciliations/${id}/reject`)
  },
}
