import type { AlertConfig, UpdateAlertConfigRequest } from '../types'
import { http } from '../lib/http'

export const settingsService = {
  async getAlertConfig(): Promise<AlertConfig> {
    const { data } = await http.get<AlertConfig>('/settings/alerts')
    return data
  },

  async updateAlertConfig(req: UpdateAlertConfigRequest): Promise<AlertConfig> {
    const { data } = await http.put<AlertConfig>('/settings/alerts', req)
    return data
  },
}
