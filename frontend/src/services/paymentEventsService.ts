import { http } from '../lib/http'
import type { PagedResult, PaymentEvent, PaymentEventListParams } from '../types'

export const paymentEventsService = {
  async list(params: PaymentEventListParams = {}): Promise<PagedResult<PaymentEvent>> {
    const { data } = await http.get<PagedResult<PaymentEvent>>('/payment-events', {
      params: { pageSize: 100, ...params },
    })
    return data
  },
}
