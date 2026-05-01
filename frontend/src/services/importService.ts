import type { ImportStatementResult, ImportSalesResult } from '../types'
import { getStoredToken } from '../contexts/AuthContext'
import { API_BASE_URL } from '../config/env'

async function postFile<T>(endpoint: string, file: File): Promise<T> {
  const form  = new FormData()
  form.append('file', file)
  const token = getStoredToken()
  const res   = await fetch(`${API_BASE_URL}${endpoint}`, {
    method:  'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body:    form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Erro ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const importService = {
  uploadStatement: (file: File) =>
    postFile<ImportStatementResult>('/import/statement', file),

  uploadSales: (file: File) =>
    postFile<ImportSalesResult>('/import/sales', file),
}
