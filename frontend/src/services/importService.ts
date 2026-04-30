import type { ImportStatementResult } from '../types'
import { getStoredToken } from '../contexts/AuthContext'
import { API_BASE_URL } from '../config/env'

export const importService = {
  async uploadStatement(file: File): Promise<ImportStatementResult> {
    const form = new FormData()
    form.append('file', file)

    // Axios remove o Content-Type ao usar FormData para que o browser
    // gere automaticamente o boundary correto no multipart
    const token = getStoredToken()
    const res = await fetch(`${API_BASE_URL}/import/statement`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? `Erro ${res.status}`)
    }
    return res.json() as Promise<ImportStatementResult>
  },
}
