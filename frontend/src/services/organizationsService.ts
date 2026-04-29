import { http } from '../lib/http'
import type { JoinRequestDto, OrgSearchDto } from '../types'

export const organizationsService = {
  async search(q: string): Promise<OrgSearchDto[]> {
    const { data } = await http.get<OrgSearchDto[]>('/organizations/search', { params: { q } })
    return data
  },

  async getPendingJoinRequests(): Promise<JoinRequestDto[]> {
    const { data } = await http.get<JoinRequestDto[]>('/organizations/join-requests/pending')
    return data
  },

  async getPendingCount(): Promise<number> {
    const { data } = await http.get<number>('/organizations/join-requests/pending/count')
    return data
  },

  async acceptJoinRequest(id: string): Promise<JoinRequestDto> {
    const { data } = await http.put<JoinRequestDto>(`/organizations/join-requests/${id}/accept`)
    return data
  },

  async rejectJoinRequest(id: string): Promise<JoinRequestDto> {
    const { data } = await http.put<JoinRequestDto>(`/organizations/join-requests/${id}/reject`)
    return data
  },
}
