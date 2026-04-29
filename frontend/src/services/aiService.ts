import { http } from '../lib/http'
import type { AiDailySummary, AiExplanation } from '../types'

export const aiService = {
  async explainReconciliation(id: string): Promise<AiExplanation> {
    const { data } = await http.get<AiExplanation>(`/ai/reconciliations/${id}/explanation`)
    return data
  },

  async getDailySummary(date?: string): Promise<AiDailySummary> {
    const { data } = await http.get<AiDailySummary>('/ai/summary/daily', {
      params: date ? { date } : undefined,
    })
    return data
  },
}
