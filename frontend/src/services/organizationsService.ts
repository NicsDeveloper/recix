import { http } from '../lib/http'
import type { JoinRequestDto, MemberDto, OrgSearchDto } from '../types'

export const organizationsService = {
  async getMembers(): Promise<MemberDto[]> {
    const { data } = await http.get<MemberDto[]>('/organizations/members')
    return data
  },

  async updateMemberRole(userId: string, role: string): Promise<MemberDto> {
    const { data } = await http.patch<MemberDto>(`/organizations/members/${userId}/role`, { role })
    return data
  },

  async removeMember(userId: string): Promise<void> {
    await http.delete(`/organizations/members/${userId}`)
  },
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

  async acceptJoinRequest(id: string, role: string): Promise<JoinRequestDto> {
    const { data } = await http.put<JoinRequestDto>(`/organizations/join-requests/${id}/accept`, { role })
    return data
  },

  async rejectJoinRequest(id: string): Promise<JoinRequestDto> {
    const { data } = await http.put<JoinRequestDto>(`/organizations/join-requests/${id}/reject`)
    return data
  },
}
