import { http } from '../lib/http'
import type { SendWebhookRequest, SendWebhookResponse } from '../types'

export const webhooksService = {
  async sendPixWebhook(request: SendWebhookRequest): Promise<SendWebhookResponse> {
    const { data } = await http.post<SendWebhookResponse>('/webhooks/pix', request)
    return data
  },
}
