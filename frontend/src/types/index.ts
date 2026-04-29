// ─── Status Enums ────────────────────────────────────────────────────────────

export type ChargeStatus = 'Pending' | 'Paid' | 'Expired' | 'Divergent' | 'Cancelled'

export type PaymentEventStatus =
  | 'Received'
  | 'Processing'
  | 'Processed'
  | 'Failed'
  | 'IgnoredDuplicate'

export type ReconciliationStatus =
  | 'Matched'
  | 'AmountMismatch'
  | 'DuplicatePayment'
  | 'PaymentWithoutCharge'
  | 'ExpiredChargePaid'
  | 'InvalidReference'
  | 'ProcessingError'

// ─── Domain Entities ─────────────────────────────────────────────────────────

export interface Charge {
  id: string
  referenceId: string
  externalId: string
  amount: number
  status: ChargeStatus
  expiresAt: string       // ISO 8601
  createdAt: string
  updatedAt: string | null
}

export interface PaymentEvent {
  id: string
  eventId: string
  externalChargeId: string | null
  referenceId: string | null
  paidAmount: number
  paidAt: string
  provider: string
  status: PaymentEventStatus
  createdAt: string
  processedAt: string | null
}

export interface ReconciliationResult {
  id: string
  chargeId: string | null
  paymentEventId: string
  status: ReconciliationStatus
  reason: string
  expectedAmount: number | null
  paidAmount: number
  createdAt: string
}

export interface DashboardSummary {
  totalCharges: number
  paidCharges: number
  pendingCharges: number
  divergentCharges: number
  expiredCharges: number
  totalReceivedAmount: number
  totalDivergentAmount: number
  reconciliationIssues: {
    amountMismatch: number
    duplicatePayment: number
    paymentWithoutCharge: number
    expiredChargePaid: number
    invalidReference: number
    processingError: number
  }
}

export interface AiExplanation {
  reconciliationId: string
  explanation: string
  generatedAt: string
  model: string
}

export interface AiDailySummary {
  date: string
  summary: string
  generatedAt: string
  model: string
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

// ─── Request / Response ───────────────────────────────────────────────────────

export interface CreateChargeRequest {
  amount: number
  expiresInMinutes: number
}

export interface SendWebhookRequest {
  eventId: string
  externalChargeId?: string
  referenceId?: string
  paidAmount: number
  paidAt: string
  provider: string
}

export interface SendWebhookResponse {
  received: boolean
  eventId: string
  status: 'Received' | 'IgnoredDuplicate'
}

// ─── Query Params ─────────────────────────────────────────────────────────────

export interface ChargeListParams {
  status?: ChargeStatus
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

export interface PaymentEventListParams {
  status?: PaymentEventStatus
  page?: number
  pageSize?: number
}

export interface ReconciliationListParams {
  status?: ReconciliationStatus
  chargeId?: string
  paymentEventId?: string
  page?: number
  pageSize?: number
}
