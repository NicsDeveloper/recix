import { http } from '../lib/http'
import type { Charge, ChargeListParams, CreateChargeRequest, PagedResult } from '../types'

export const chargesService = {
  async list(params: ChargeListParams = {}): Promise<PagedResult<Charge>> {
    const { data } = await http.get<PagedResult<Charge>>('/charges', {
      params: { pageSize: 100, ...params },
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
