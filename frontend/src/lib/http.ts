import axios, { AxiosError } from 'axios'
import { API_BASE_URL } from '../config/env'
import { getStoredToken } from '../contexts/AuthContext'

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request interceptor — injeta JWT ────────────────────────────────────────

http.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Response interceptor ────────────────────────────────────────────────────

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (!error.response) {
      // Network error — API offline
      return Promise.reject(
        new Error('Não foi possível conectar à API. Verifique se o backend está rodando.'),
      )
    }

    const { status, data } = error.response as { status: number; data: unknown }

    if (status === 401) {
      // Token expirado ou inválido — limpa sessão e redireciona para login
      localStorage.removeItem('recix_token')
      localStorage.removeItem('recix_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(new Error('Sessão expirada. Faça login novamente.'))
    }

    if (status === 404) {
      return Promise.reject(new Error('Recurso não encontrado.'))
    }

    if (status === 400) {
      const body = data as { title?: string; errors?: Record<string, string[]> }
      const message = body?.title ?? 'Requisição inválida.'
      const err = new Error(message) as Error & { validationErrors?: Record<string, string[]> }
      err.validationErrors = body?.errors
      return Promise.reject(err)
    }

    return Promise.reject(new Error('Erro interno do servidor. Tente novamente.'))
  },
)
