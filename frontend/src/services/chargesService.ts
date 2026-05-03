import { http } from '../lib/http'
import type { Charge, ChargeListParams, CreateChargeRequest, PagedResult } from '../types'

export const chargesService = {
  async list(params: ChargeListParams = {}): Promise<PagedResult<Charge>> {
    const { data } = await http.get<PagedResult<Charge>>('/charges', {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        ...(params.status ? { status: params.status } : {}),
        ...(params.fromDate ? { fromDate: params.fromDate } : {}),
        ...(params.toDate ? { toDate: params.toDate } : {}),
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
}
