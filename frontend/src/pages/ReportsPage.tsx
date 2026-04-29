import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, FileSpreadsheet, FileJson, FileText, CalendarDays, Database, ArrowDownToLine } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { FilterBar } from '../components/ui/FilterBar'
import { chargesService } from '../services/chargesService'
import { paymentEventsService } from '../services/paymentEventsService'
import { reconciliationsService } from '../services/reconciliationsService'
import { formatCurrency, formatDateTime } from '../lib/formatters'

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
    </div>
  )
}
