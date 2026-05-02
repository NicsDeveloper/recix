import { http } from '../lib/http'
import type { AuthResponse } from '../types'

export const authService = {
  async register(
    email: string,
    name: string,
    password: string,
    orgName?: string,
    joinOrgId?: string,
    message?: string,
  ): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/register', {
      email, name, password,
      orgName:   orgName   || undefined,
      joinOrgId: joinOrgId || undefined,
      message:   message   || undefined,
    })
    return data
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/login', { email, password })
    return data
  },

  async googleAuth(credential: string): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/google', { credential })
    return data
  },

  async refresh(): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/refresh')
    return data
  },
}
