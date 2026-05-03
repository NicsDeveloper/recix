import type {
  ImportStatementResult, ImportSalesResult, ImportPreviewResult,
  ImportPreviewLine, LineValidationStatus,
} from '../types'
import { getStoredToken } from '../contexts/AuthContext'
import { API_BASE_URL } from '../config/env'

/** API serializa enums como inteiros; o UI usa strings PascalCase. */
function normalizeLineStatus(raw: unknown): LineValidationStatus {
  if (raw === 0 || raw === '0') return 'Ok'
  if (raw === 1 || raw === '1') return 'Warning'
  if (raw === 2 || raw === '2') return 'Error'
  if (raw === 'Ok' || raw === 'ok') return 'Ok'
  if (raw === 'Warning' || raw === 'warning') return 'Warning'
  if (raw === 'Error' || raw === 'error') return 'Error'
  return 'Error'
}

function normalizeImportPreviewType(raw: unknown): ImportPreviewResult['type'] {
  if (raw === 0 || raw === '0' || raw === 'Sales' || raw === 'sales') return 'Sales'
  if (raw === 1 || raw === '1' || raw === 'BankStatement' || raw === 'bankStatement') return 'BankStatement'
  return 'Sales'
}

function normalizeImportPreview(data: ImportPreviewResult): ImportPreviewResult {
  const lines = (data.lines ?? []).map((l): ImportPreviewLine => ({
    ...l,
    status: normalizeLineStatus(l.status as unknown),
  }))
  return {
    ...data,
    type: normalizeImportPreviewType(data.type as unknown),
    lines,
  }
}

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

async function postPreviewFile(endpoint: string, file: File): Promise<ImportPreviewResult> {
  const raw = await postFile<ImportPreviewResult>(endpoint, file)
  return normalizeImportPreview(raw)
}

export const importService = {
  previewSales:      (file: File) => postPreviewFile('/import/preview/sales', file),
  previewStatement:  (file: File) => postPreviewFile('/import/preview/statement', file),
  uploadStatement:   (file: File) => postFile<ImportStatementResult>('/import/statement', file),
  uploadSales:       (file: File) => postFile<ImportSalesResult>('/import/sales', file),
}
