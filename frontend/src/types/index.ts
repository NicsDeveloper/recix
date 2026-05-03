// ─── Status Enums ────────────────────────────────────────────────────────────

export type ChargeStatus =
  | 'Pending'
  | 'PendingReview'
  | 'PartiallyPaid'
  | 'Paid'
  | 'Expired'
  | 'Divergent'
  | 'Overpaid'
  | 'Cancelled'

export type PaymentEventStatus =
  | 'Received'
  | 'Processing'
  | 'Processed'
  | 'Failed'
  | 'IgnoredDuplicate'

export type ReconciliationStatus =
  // Sucesso
  | 'Matched'
  | 'MatchedLowConfidence'       // match por valor — aguarda revisão humana
  | 'PartialPayment'             // parcial — ainda falta valor
  // Divergências
  | 'AmountMismatch'
  | 'PaymentExceedsExpected'
  | 'DuplicatePayment'
  | 'ExpiredChargePaid'
  // Ausência de correspondência
  | 'PaymentWithoutCharge'
  | 'ChargeWithoutPayment'       // cobrança que venceu sem pagamento
  | 'MultipleMatchCandidates'   // fuzzy encontrou > 1 candidato
  // Erros
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
  pixCopiaECola: string | null
  /** Auditoria agregada (API): Conciliado | Parcial | Divergente | EmRevisao | SemAlocacao */
  reconciliationAggregate?: string | null
}

/** Uma linha por cobrança na visão de auditoria. */
export interface ChargeReconciliationSummary {
  chargeId: string
  chargeReferenceId: string
  expectedAmount: number
  totalPaidAllocated: number
  netDifference: number
  aggregateStatus: string
  lastEventAt: string
  paymentLines: RecentReconciliation[]
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
  /** Soma dos valores das cobranças no período (inclui pendentes; exclui canceladas). */
  totalExpectedAmount: number
  totalReceivedAmount: number
  totalDivergentAmount: number
  /** Soma monetária das conciliações problemáticas (pode ser maior que zero quando totalDivergentAmount é 0). */
  totalReconciliationAttentionAmount?: number
  /** Quantos resultados de conciliação aguardam revisão humana. */
  pendingReviewCount: number
  /** False enquanto houver itens pendentes de revisão — bloqueia o fechamento do período. */
  periodCloseable: boolean
  reconciliationIssues: {
    matched: number
    matchedLowConfidence: number
    amountMismatch: number
    partialPayment: number
    paymentExceedsExpected: number
    duplicatePayment: number
    paymentWithoutCharge: number
    chargeWithoutPayment: number
    multipleMatchCandidates: number
    expiredChargePaid: number
    invalidReference: number
    processingError: number
  }
}

export interface FluxPoint {
  label: string
  received: number
  expected: number
  divergent: number
}

export interface RecentReconciliation {
  id: string
  /** Presente quando a conciliação está ligada a uma cobrança (link operacional). */
  chargeId?: string | null
  status: ReconciliationStatus
  reason: string
  expectedAmount: number | null
  paidAmount: number
  chargeReferenceId: string | null
  paymentEventId: string
  provider: string | null
  createdAt: string
  confidence: 'High' | 'Medium' | 'Low'
  matchReason: string
  matchedField: string | null
  requiresReview: boolean
}

export interface PendingReviewItem {
  id: string
  status: string
  confidence: 'High' | 'Medium' | 'Low'
  matchReason: string
  matchedField: string | null
  reason: string
  chargeId: string | null
  paymentEventId: string | null
  expectedAmount: number | null
  paidAmount: number
  createdAt: string
  /** Código RECIX-… da cobrança sugerida */
  chargeReferenceId?: string | null
  /** ID vindo do ERP / coluna referencia do CSV de vendas */
  chargeExternalId?: string | null
  /** ID da linha no extrato (eventId) */
  paymentTransactionId?: string | null
  paymentReferenceId?: string | null
  paymentProvider?: string | null
  paymentPaidAt?: string | null
}

export interface PendingReviewList {
  totalCount: number
  items: PendingReviewItem[]
}

export interface RecentPaymentEvent {
  eventId: string
  referenceId: string | null
  paidAmount: number
  provider: string
  status: PaymentEventStatus
  paidAt: string
  processedAt: string | null
  createdAt: string
}

export interface DashboardAlert {
  type: 'amountMismatch' | 'duplicatePayment' | 'paymentWithoutCharge'
  count: number
  lastDetectedAt: string
  description: string
  routeStatus: ReconciliationStatus
}

export interface DashboardOverview {
  updatedAt: string
  summary: DashboardSummary
  previousPeriodSummary: DashboardSummary
  fluxSeries: FluxPoint[]
  recentReconciliations: RecentReconciliation[]
  recentPaymentEvents: RecentPaymentEvent[]
  alerts: DashboardAlert[]
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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface UserDto {
  id:    string
  email: string
  name:  string
  role:  string
}

export interface OrgMembershipDto {
  orgId:     string
  name:      string
  slug:      string
  role:      string
  isCurrent: boolean
}

export interface OrgSearchDto {
  id:          string
  name:        string
  slug:        string
  memberCount: number
}

export interface JoinRequestDto {
  id:          string
  orgId:       string
  orgName:     string
  orgSlug:     string
  userId:      string
  userName:    string
  userEmail:   string
  status:      'Pending' | 'Accepted' | 'Rejected'
  message:     string | null
  requestedAt: string
  reviewedAt:  string | null
}

export interface MemberDto {
  userId:   string
  name:     string
  email:    string
  role:     string
  joinedAt: string
}

export interface AuthResponse {
  token:              string
  user:               UserDto
  organizations:      OrgMembershipDto[]
  pendingJoinRequest: JoinRequestDto | null
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

// ─── Closing Report ──────────────────────────────────────────────────────────

export interface UnreconciledCharge {
  id: string
  referenceId: string
  amount: number
  status: ChargeStatus
  expiresAt: string
  createdAt: string
}

export interface ClosingReport {
  from: string
  to: string
  totalCharges: number
  paidCharges: number
  pendingCharges: number
  divergentCharges: number
  expiredCharges: number
  expectedAmount: number
  receivedAmount: number
  divergentAmount: number
  pendingAmount: number
  recoveryRate: number
  reconciliationsTotal: number
  reconciliationsMatched: number
  reconciliationsMatchedLowConfidence: number
  reconciliationsAmountMismatch: number
  reconciliationsPartialPayment: number
  reconciliationsPaymentExceedsExpected: number
  reconciliationsDuplicate: number
  reconciliationsNoCharge: number
  reconciliationsChargeWithoutPayment: number
  reconciliationsMultipleMatch: number
  reconciliationsExpiredPaid: number
  reconciliationsInvalidRef: number
  reconciliationsError: number
  unreconciled: UnreconciledCharge[]
  generatedAt: string
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportLineResult {
  line: number
  eventId: string
  /** 'Imported' | 'Duplicate' | 'Error' */
  status: string
  error?: string | null
}

export interface ImportStatementResult {
  imported: number
  duplicates: number
  errors: number
  lines: ImportLineResult[]
}

export interface ImportSalesLineResult {
  line: number
  description: string
  amount: number
  /** 'Created' | 'Skipped' | 'Error' */
  status: string
  referenceId?: string | null
  error?: string | null
}

export interface ImportSalesResult {
  created: number
  skipped: number
  errors: number
  lines: ImportSalesLineResult[]
}

// ─── Import Preview ───────────────────────────────────────────────────────────

export type LineValidationStatus = 'Ok' | 'Warning' | 'Error'

export interface ImportPreviewLine {
  lineNumber:  number
  status:      LineValidationStatus
  message:     string | null
  eventId:     string | null
  amount:      number | null
  date:        string | null
  description: string | null
  reference:   string | null
  provider:    string | null
}

export interface ImportPreviewResult {
  type:             'Sales' | 'BankStatement'
  fileName:         string
  totalLines:       number
  validLines:       number
  warningLines:     number
  errorLines:       number
  hasBlockingErrors: boolean
  detectedColumns:  string[]
  lines:            ImportPreviewLine[]
}

// ─── Alert Config ─────────────────────────────────────────────────────────────

export interface AlertConfig {
  webhookUrl: string | null
  notifyAmountMismatch: boolean
  notifyDuplicatePayment: boolean
  notifyPaymentWithoutCharge: boolean
  notifyExpiredChargePaid: boolean
  updatedAt: string
}

export interface UpdateAlertConfigRequest {
  webhookUrl?: string | null
  notifyAmountMismatch: boolean
  notifyDuplicatePayment: boolean
  notifyPaymentWithoutCharge: boolean
  notifyExpiredChargePaid: boolean
}
