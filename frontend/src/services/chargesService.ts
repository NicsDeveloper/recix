import { http } from '../lib/http'
import { normalizeDateParamForApi } from '../lib/dateRangeParam'
import type { Charge, ChargeListParams, CreateChargeRequest, PagedResult } from '../types'

export const chargesService = {
  async list(params: ChargeListParams = {}): Promise<PagedResult<Charge>> {
    const fromDate = params.fromDate
      ? (params.fromDate.includes('T') ? params.fromDate : normalizeDateParamForApi(params.fromDate, 'start'))
      : undefined
    const toDate = params.toDate
      ? (params.toDate.includes('T') ? params.toDate : normalizeDateParamForApi(params.toDate, 'end'))
      : undefined

    const { data } = await http.get<PagedResult<Charge>>('/charges', {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        ...(params.status ? { status: params.status } : {}),
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
      },
    })
    return data
  },

  async getById(id: string): Promise<Charge> {
    const { data } = await http.get<Charge>(`/charges/${id}`)
    return data
  },

  async create(request: CreateChargeRequest): Promise<Charge> {
    const { data } = await http.post<Charge>('/charges', request)
    return data
  },

  async cancel(id: string): Promise<void> {
    await http.post(`/charges/${id}/cancel`)
  },
}
