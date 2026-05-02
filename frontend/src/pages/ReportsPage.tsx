import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet, FileJson, FileText, CalendarDays, Database, ArrowDownToLine, CheckCircle, AlertTriangle, Eye, BarChart2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { FilterBar } from '../components/ui/FilterBar'
import { chargesService } from '../services/chargesService'
import { paymentEventsService } from '../services/paymentEventsService'
import { reconciliationsService } from '../services/reconciliationsService'
import { dashboardService } from '../services/dashboardService'
import { formatCurrency, formatDateTime } from '../lib/formatters'
import type { ClosingReport } from '../types'

type ReportType = 'charges' | 'payment-events' | 'reconciliations'
type ReportFormat = 'csv' | 'json' | 'pdf'

function toInputDate(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function isInRange(iso: string, fromDate: string, toDate: string) {
  const d = new Date(iso).getTime()
  const from = parseDate(fromDate).getTime()
  const to = parseDate(toDate).getTime() + 24 * 60 * 60 * 1000 - 1
  return d >= from && d <= to
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return 'Sem dados para exportar.\n'
  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','))
  }
  return `${lines.join('\n')}\n`
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function generatePdf(
  rows: Record<string, unknown>[],
  reportType: ReportType,
  fromDate: string,
  toDate: string,
  filename: string,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(`RECIX - Relatório de ${reportLabel(reportType)}`, 14, 14)
  doc.setFontSize(10)
  doc.text(`Período: ${fromDate} até ${toDate}`, 14, 21)
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 27)

  if (!rows.length) {
    doc.text('Sem dados para o período selecionado.', 14, 38)
    doc.save(filename)
    return
  }

  const statusLabels: Record<string, string> = {
    Pending: 'Pendente',
    Paid: 'Pago',
    Expired: 'Expirado',
    Divergent: 'Divergente',
    Cancelled: 'Cancelado',
    Received: 'Recebido',
    Processing: 'Processando',
    Processed: 'Processado',
    Failed: 'Falhou',
    IgnoredDuplicate: 'Duplicado ignorado',
    Matched: 'Conciliado',
    AmountMismatch: 'Valor divergente',
    DuplicatePayment: 'Pagamento duplicado',
    PaymentWithoutCharge: 'Sem cobrança',
    ExpiredChargePaid: 'Expirada paga',
    InvalidReference: 'Referência inválida',
    ProcessingError: 'Erro de processamento',
  }

  const short = (value: unknown) => {
    const text = String(value ?? '')
    return text.length > 14 ? `${text.slice(0, 6)}...${text.slice(-4)}` : text
  }

  const fmtDate = (value: unknown) => {
    const text = String(value ?? '')
    if (!text) return ''
    return formatDateTime(text)
  }

  const fmtMoney = (value: unknown) => {
    const n = Number(value ?? 0)
    return Number.isFinite(n) ? formatCurrency(n) : ''
  }

  const formatStatus = (value: unknown) => statusLabels[String(value ?? '')] ?? String(value ?? '')

  const normalized =
    reportType === 'charges'
      ? rows.map((r) => {
          const row = r as Record<string, unknown>
          return {
            Referência: row.referenceId,
            Externo: short(row.externalId),
            Valor: fmtMoney(row.amount),
            Status: formatStatus(row.status),
            Expira: fmtDate(row.expiresAt),
            CriadoEm: fmtDate(row.createdAt),
            Atualizado: fmtDate(row.updatedAt),
          }
        })
      : reportType === 'payment-events'
        ? rows.map((r) => {
            const row = r as Record<string, unknown>
            return {
              EventId: short(row.eventId),
              Referência: row.referenceId,
              ValorPago: fmtMoney(row.paidAmount),
              Provedor: row.provider,
              Status: formatStatus(row.status),
              PagoEm: fmtDate(row.paidAt),
              ProcessadoEm: fmtDate(row.processedAt),
            }
          })
        : rows.map((r) => {
            const row = r as Record<string, unknown>
            return {
              Conciliação: short(row.id),
              ChargeId: short(row.chargeId),
              Status: formatStatus(row.status),
              Esperado: row.expectedAmount === '' ? '' : fmtMoney(row.expectedAmount),
              Pago: fmtMoney(row.paidAmount),
              Motivo: row.reason,
              CriadoEm: fmtDate(row.createdAt),
            }
          })

  const headers = Object.keys(normalized[0])
  const body = normalized.map((row) => headers.map((h) => String(row[h as keyof typeof row] ?? '')))

  autoTable(doc, {
    head: [headers],
    body,
    startY: 34,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [41, 59, 95] },
    margin: { left: 10, right: 10 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 34 },
      2: { cellWidth: 30 },
      3: { cellWidth: 32 },
      4: { cellWidth: 34 },
      5: { cellWidth: 34 },
    },
  })

  doc.save(filename)
}

function reportLabel(type: ReportType) {
  return type === 'charges'
    ? 'Cobranças'
    : type === 'payment-events'
      ? 'Eventos de Pagamento'
      : 'Conciliações'
}

// ─── Closing Report ──────────────────────────────────────────────────────────

const RECON_ROWS: Array<{
  key: keyof ClosingReport
  label: string
  color: string
  attention?: boolean
}> = [
  { key: 'reconciliationsMatched',              label: 'Conciliado (alta confiança)',  color: 'text-green-400' },
  { key: 'reconciliationsMatchedLowConfidence', label: 'Revisar match (baixa conf.)',  color: 'text-amber-400', attention: true },
  { key: 'reconciliationsAmountMismatch',       label: 'Valor divergente',            color: 'text-red-400',   attention: true },
  { key: 'reconciliationsDuplicate',            label: 'Pagamento duplicado',         color: 'text-orange-400',attention: true },
  { key: 'reconciliationsNoCharge',             label: 'Pagamento sem cobrança',      color: 'text-yellow-400',attention: true },
  { key: 'reconciliationsChargeWithoutPayment', label: 'Cobrança sem pagamento',      color: 'text-red-400',   attention: true },
  { key: 'reconciliationsMultipleMatch',        label: 'Múltiplos candidatos',        color: 'text-indigo-400',attention: true },
  { key: 'reconciliationsExpiredPaid',          label: 'Cobrança expirada paga',      color: 'text-gray-400',  attention: true },
  { key: 'reconciliationsInvalidRef',           label: 'Referência inválida',         color: 'text-purple-400',attention: true },
  { key: 'reconciliationsError',                label: 'Erro de processamento',       color: 'text-gray-500',  attention: true },
]

function ClosingReportSection({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['closing-report', fromDate, toDate],
    queryFn: () => dashboardService.getClosingReport({ fromDate, toDate }),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex items-center justify-center h-48">
        <p className="text-sm text-gray-500 animate-pulse">Carregando relatório...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-sm text-red-400">Erro ao carregar o relatório de fechamento.</p>
      </div>
    )
  }

  const r = data
  const attentionCount = RECON_ROWS
    .filter(row => row.attention)
    .reduce((sum, row) => sum + (Number(r[row.key]) || 0), 0)
  const closeable = attentionCount === 0

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <BarChart2 size={15} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Relatório de Fechamento</h2>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
          closeable
            ? 'text-green-400 border-green-500/20 bg-green-500/10'
            : 'text-amber-400 border-amber-500/20 bg-amber-500/10'
        }`}>
          {closeable
            ? <><CheckCircle size={12} /> Período fechável</>
            : <><Eye size={12} /> {attentionCount} ocorrência{attentionCount !== 1 ? 's' : ''} pendente{attentionCount !== 1 ? 's' : ''}</>
          }
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* KPIs financeiros */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Financeiro</p>
          {[
            { label: 'Valor esperado',   value: formatCurrency(r.expectedAmount),  color: 'text-gray-200' },
            { label: 'Valor recebido',   value: formatCurrency(r.receivedAmount),  color: 'text-green-400' },
            { label: 'Valor divergente', value: formatCurrency(r.divergentAmount), color: r.divergentAmount > 0 ? 'text-red-400' : 'text-gray-400' },
            { label: 'Valor pendente',   value: formatCurrency(r.pendingAmount),   color: r.pendingAmount > 0 ? 'text-yellow-400' : 'text-gray-400' },
            { label: 'Taxa de recuperação', value: `${Number(r.recoveryRate).toFixed(1)}%`, color: Number(r.recoveryRate) >= 95 ? 'text-green-400' : 'text-orange-400' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{item.label}</span>
              <span className={`text-sm font-semibold tabular-nums ${item.color}`}>{item.value}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-800 space-y-1">
            {[
              { label: 'Cobranças totais',    value: r.totalCharges },
              { label: 'Pagas',               value: r.paidCharges,     color: 'text-green-400' },
              { label: 'Pendentes',           value: r.pendingCharges,  color: r.pendingCharges  > 0 ? 'text-yellow-400' : undefined },
              { label: 'Divergentes',         value: r.divergentCharges,color: r.divergentCharges > 0 ? 'text-red-400' : undefined },
              { label: 'Expiradas',           value: r.expiredCharges,  color: r.expiredCharges  > 0 ? 'text-gray-400' : undefined },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className={`text-xs font-semibold tabular-nums ${item.color ?? 'text-gray-300'}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown de conciliações */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Conciliações ({r.reconciliationsTotal} total)</p>
          {RECON_ROWS.map(row => {
            const count = Number(r[row.key]) || 0
            const pct = r.reconciliationsTotal > 0 ? (count / r.reconciliationsTotal) * 100 : 0
            return (
              <div key={row.key}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    {row.attention && count > 0 && <AlertTriangle size={10} className="text-amber-400 flex-shrink-0" />}
                    <span className="text-xs text-gray-400">{row.label}</span>
                  </div>
                  <span className={`text-xs font-semibold tabular-nums ${count > 0 ? row.color : 'text-gray-600'}`}>{count}</span>
                </div>
                {r.reconciliationsTotal > 0 && (
                  <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${count === 0 ? 'bg-gray-700' : row.attention ? 'bg-red-500/50' : 'bg-green-500/50'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cobranças não conciliadas */}
      {r.unreconciled.length > 0 && (
        <div className="border-t border-gray-800 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Cobranças sem conciliação ({r.unreconciled.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left">
                  {['Referência', 'Valor', 'Status', 'Expira em'].map(h => (
                    <th key={h} className="pb-2 pr-4 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.unreconciled.slice(0, 10).map(u => (
                  <tr key={u.id} className="border-t border-gray-800/50">
                    <td className="py-1.5 pr-4 font-mono text-gray-300">{u.referenceId}</td>
                    <td className="py-1.5 pr-4 text-gray-200 font-semibold tabular-nums">{formatCurrency(u.amount)}</td>
                    <td className="py-1.5 pr-4 text-gray-400">{u.status}</td>
                    <td className="py-1.5 text-gray-500">{new Date(u.expiresAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
                {r.unreconciled.length > 10 && (
                  <tr><td colSpan={4} className="pt-2 text-gray-600 text-[10px]">+ {r.unreconciled.length - 10} mais</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border-t border-gray-800 px-5 py-2.5">
        <p className="text-[10px] text-gray-600">Gerado em {new Date(r.generatedAt).toLocaleString('pt-BR')}</p>
      </div>
    </div>
  )
}

export function ReportsPage() {
  const today = new Date()
  const [fromDate, setFromDate] = useState(toInputDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)))
  const [toDate, setToDate] = useState(toInputDate(today))
  const [reportType, setReportType] = useState<ReportType>('charges')
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv')
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null)
  const [lastCount, setLastCount] = useState(0)
  const [lastAmountTotal, setLastAmountTotal] = useState(0)

  const invalidRange = useMemo(() => parseDate(toDate) < parseDate(fromDate), [fromDate, toDate])

  const { mutate: generateReport, isPending, error } = useMutation({
    mutationFn: async (_: { format: ReportFormat }) => {
      if (reportType === 'charges') {
        const result = await chargesService.list()
        return result.items
          .filter((c) => isInRange(c.createdAt, fromDate, toDate))
          .map((c) => ({
            id: c.id,
            referenceId: c.referenceId,
            externalId: c.externalId,
            amount: c.amount,
            status: c.status,
            expiresAt: c.expiresAt,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt ?? '',
          }))
      }

      if (reportType === 'payment-events') {
        const result = await paymentEventsService.list()
        return result.items
          .filter((e) => isInRange(e.createdAt, fromDate, toDate))
          .map((e) => ({
            id: e.id,
            eventId: e.eventId,
            externalChargeId: e.externalChargeId ?? '',
            referenceId: e.referenceId ?? '',
            paidAmount: e.paidAmount,
            provider: e.provider,
            status: e.status,
            paidAt: e.paidAt,
            processedAt: e.processedAt ?? '',
            createdAt: e.createdAt,
          }))
      }

      const result = await reconciliationsService.list()
      return result.items
        .filter((r) => isInRange(r.createdAt, fromDate, toDate))
        .map((r) => ({
          id: r.id,
          chargeId: r.chargeId ?? '',
          paymentEventId: r.paymentEventId,
          status: r.status,
          reason: r.reason,
          expectedAmount: r.expectedAmount ?? '',
          paidAmount: r.paidAmount,
          createdAt: r.createdAt,
        }))
    },
    onSuccess: (rows, variables) => {
      const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
      const baseName = `recix-${reportType}-${fromDate}-a-${toDate}-${stamp}`
      const outputFormat = variables.format
      if (outputFormat === 'json') {
        downloadFile(JSON.stringify(rows, null, 2), `${baseName}.json`, 'application/json;charset=utf-8')
      } else if (outputFormat === 'csv') {
        downloadFile(toCsv(rows), `${baseName}.csv`, 'text/csv;charset=utf-8')
      } else {
        void generatePdf(rows, reportType, fromDate, toDate, `${baseName}.pdf`)
      }

      const total = rows.reduce((sum, row) => {
        const safeRow = row as Record<string, unknown>
        const amount = Number(safeRow.amount ?? safeRow.paidAmount ?? 0)
        return Number.isFinite(amount) ? sum + amount : sum
      }, 0)
      setLastCount(rows.length)
      setLastAmountTotal(total)
      setLastGeneratedAt(new Date().toISOString())
    },
  })

  return (
    <div>
      <Header
        title="Relatórios"
        subtitle="Gere exportações operacionais de cobranças, eventos e conciliações"
      />

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Database size={12} />
              Tipo de relatório
            </p>
            <p className="text-sm text-gray-200 mt-1">{reportLabel(reportType)}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <CalendarDays size={12} />
              Período
            </p>
            <p className="text-sm text-gray-200 mt-1">{fromDate} até {toDate}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <FileText size={12} />
              Formato de saída
            </p>
            <p className="text-sm text-gray-200 mt-1">{reportFormat.toUpperCase()}</p>
          </div>
        </div>

        <FilterBar className="mb-0">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">De</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Até</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 px-3 py-2"
            />
          </div>

          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 px-3 py-2"
          >
            <option value="charges">Cobranças</option>
            <option value="payment-events">Eventos de Pagamento</option>
            <option value="reconciliations">Conciliações</option>
          </select>

          <select
            value={reportFormat}
            onChange={(e) => setReportFormat(e.target.value as ReportFormat)}
            className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 px-3 py-2"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="pdf">PDF</option>
          </select>

          <button
            onClick={() => generateReport({ format: reportFormat })}
            disabled={isPending || invalidRange}
            className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={15} />
            {isPending ? 'Gerando...' : 'Gerar relatório'}
          </button>
        </FilterBar>
      </div>

      {invalidRange && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          O período é inválido: a data final deve ser maior ou igual à data inicial.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => generateReport({ format: 'csv' })}
          disabled={isPending || invalidRange}
          title="Clique para baixar CSV"
          className="text-left rounded-xl border border-gray-800 bg-gray-900 p-5 hover:bg-gray-800/60 hover:border-indigo-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 text-gray-200">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} />
              <h2 className="text-sm font-semibold">Formato CSV</h2>
            </div>
            <ArrowDownToLine size={14} className="text-indigo-300" />
          </div>
          <p className="text-xs text-indigo-300 mt-2">Clique para baixar</p>
          <p className="text-xs text-gray-500 mt-1">
            Ideal para análise em planilhas e compartilhamento com times financeiros.
          </p>
        </button>
        <button
          onClick={() => generateReport({ format: 'json' })}
          disabled={isPending || invalidRange}
          title="Clique para baixar JSON"
          className="text-left rounded-xl border border-gray-800 bg-gray-900 p-5 hover:bg-gray-800/60 hover:border-indigo-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 text-gray-200">
            <div className="flex items-center gap-2">
              <FileJson size={16} />
              <h2 className="text-sm font-semibold">Formato JSON</h2>
            </div>
            <ArrowDownToLine size={14} className="text-indigo-300" />
          </div>
          <p className="text-xs text-indigo-300 mt-2">Clique para baixar</p>
          <p className="text-xs text-gray-500 mt-1">
            Ideal para integrações técnicas e auditoria detalhada de dados.
          </p>
        </button>
        <button
          onClick={() => generateReport({ format: 'pdf' })}
          disabled={isPending || invalidRange}
          title="Clique para baixar PDF"
          className="text-left rounded-xl border border-gray-800 bg-gray-900 p-5 hover:bg-gray-800/60 hover:border-indigo-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 text-gray-200">
            <div className="flex items-center gap-2">
              <FileText size={16} />
              <h2 className="text-sm font-semibold">Formato PDF</h2>
            </div>
            <ArrowDownToLine size={14} className="text-indigo-300" />
          </div>
          <p className="text-xs text-indigo-300 mt-2">Clique para baixar</p>
          <p className="text-xs text-gray-500 mt-1">
            Ideal para envio executivo e documentação de auditoria em arquivo fechado.
          </p>
        </button>
      </div>

      {lastGeneratedAt && (
        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
          <p className="text-xs text-gray-500">
            Último relatório gerado em {formatDateTime(lastGeneratedAt)}.
          </p>
          <p className="text-xs text-gray-300 mt-1">
            Registros: <span className="font-semibold">{lastCount.toLocaleString('pt-BR')}</span>
            {' '}• Total financeiro estimado:{' '}
            <span className="font-semibold">{formatCurrency(lastAmountTotal)}</span>
          </p>
        </div>
      )}

      <div className="mt-6">
        <ClosingReportSection fromDate={fromDate} toDate={toDate} />
      </div>
    </div>
  )
}
