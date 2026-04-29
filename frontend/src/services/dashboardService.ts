import { http } from '../lib/http'
import type { DashboardSummary } from '../types'

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    const { data } = await http.get<DashboardSummary>('/dashboard/summary')
    return data
  },
}
