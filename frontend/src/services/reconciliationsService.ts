import { http } from '../lib/http'
import type { PagedResult, ReconciliationListParams, ReconciliationResult } from '../types'

export const reconciliationsService = {
  async list(params: ReconciliationListParams = {}): Promise<PagedResult<ReconciliationResult>> {
    const { data } = await http.get<PagedResult<ReconciliationResult>>('/reconciliations', {
      params: { pageSize: 100, ...params },
    })
    return data
  },
}
