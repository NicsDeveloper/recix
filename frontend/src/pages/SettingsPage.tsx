import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings,
  Bell,
  CheckCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  BarChart3,
  CalendarDays,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { LoadingState } from '../components/ui/LoadingState'
import { ErrorState } from '../components/ui/ErrorState'
import { settingsService } from '../services/settingsService'
import { dashboardService } from '../services/dashboardService'
import { formatCurrency, formatDateTime } from '../lib/formatters'
import { useAuth } from '../contexts/AuthContext'
import type { ClosingReport, UpdateAlertConfigRequest } from '../types'

function toInputDate(date: Date) {
  const yyyy = date.getFullYear()
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const dd   = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ─────────────────────────────────────────────────────────────────────────────

function ClosingReportSection() {
  const today    = new Date()
  const [from, setFrom] = useState(toInputDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)))
  const [to, setTo]     = useState(toInputDate(today))
  const [queried, setQueried] = useState(false)

  const { data: report, isLoading, isError, refetch } = useQuery<ClosingReport>({
    queryKey: ['closing-report', from, to],
    queryFn: () => dashboardService.getClosingReport({ fromDate: from, toDate: to }),
    enabled: queried,
    staleTime: 60_000,
  })

  function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-800/60 last:border-0">
        <span className="text-sm text-gray-400">{label}</span>
        <div className="text-right">
          <span className="text-sm font-semibold text-gray-200">{value}</span>
          {sub && <p className="text-xs text-gray-600">{sub}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-gray-200">Relatório de Fechamento</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Visão consolidada do período: quanto era esperado receber, quanto realmente entrou e
        o que ficou em aberto ou divergiu.
      </p>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">De</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 px-3 py-1.5" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Até</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 px-3 py-1.5" />
        </div>
        <button
          onClick={() => { setQueried(true); void refetch() }}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? <Loader2 size={13} className="animate-spin" /> : <CalendarDays size={13} />}
          Gerar
        </button>
      </div>

      {isError && <p className="text-sm text-red-400">Erro ao carregar relatório.</p>}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Financeiro */}
          <div className="rounded-lg border border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp size={11} /> Financeiro
            </p>
            <StatRow label="Esperado" value={formatCurrency(report.expectedAmount)} />
            <StatRow label="Recebido" value={formatCurrency(report.receivedAmount)} sub={`${report.recoveryRate}% do esperado`} />
            <StatRow label="Divergente" value={formatCurrency(report.divergentAmount)} />
            <StatRow label="Pendente" value={formatCurrency(report.pendingAmount)} />
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Taxa de recuperação</span>
                <span className="font-semibold text-gray-300">{report.recoveryRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
                  style={{ width: `${Math.min(report.recoveryRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Conciliações */}
          <div className="rounded-lg border border-gray-800 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck size={11} /> Conciliações
            </p>
            <StatRow label="Total" value={String(report.reconciliationsTotal)} />
            <StatRow label="Conciliados" value={String(report.reconciliationsMatched)} />
            {report.reconciliationsAmountMismatch > 0 && (
              <StatRow label="Valor divergente" value={String(report.reconciliationsAmountMismatch)} />
            )}
            {report.reconciliationsDuplicate > 0 && (
              <StatRow label="Duplicados" value={String(report.reconciliationsDuplicate)} />
            )}
            {report.reconciliationsNoCharge > 0 && (
              <StatRow label="Sem cobrança" value={String(report.reconciliationsNoCharge)} />
            )}
            {report.reconciliationsExpiredPaid > 0 && (
              <StatRow label="Expiradas pagas" value={String(report.reconciliationsExpiredPaid)} />
            )}
            <StatRow label="Cobranças pendentes/expiradas" value={String(report.pendingCharges + report.expiredCharges)} />
          </div>

          {/* Não conciliadas */}
          {report.unreconciled.length > 0 && (
            <div className="md:col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-amber-400" />
                <p className="text-xs font-semibold text-amber-400">
                  {report.unreconciled.length} cobrança(s) sem conciliação no período
                </p>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {report.unreconciled.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-400 truncate max-w-[200px]">{c.referenceId}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-300 font-semibold">{formatCurrency(c.amount)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.status === 'Expired' ? 'bg-gray-800 text-gray-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {c.status === 'Expired' ? 'Expirado' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {report.unreconciled.length === 50 && (
                <p className="text-xs text-gray-500 mt-2">Mostrando os 50 de maior valor.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function AlertConfigSection() {
  const { currentOrg } = useAuth()
  const isAdmin = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'
  const qc = useQueryClient()

  const { data: config, isLoading, isError } = useQuery({
    queryKey: ['alert-config'],
    queryFn: () => settingsService.getAlertConfig(),
    staleTime: 60_000,
  })

  const [webhookUrl, setWebhookUrl]                     = useState('')
  const [notifyAmountMismatch, setNotifyAmountMismatch] = useState(true)
  const [notifyDuplicate, setNotifyDuplicate]           = useState(true)
  const [notifyNoCharge, setNotifyNoCharge]             = useState(true)
  const [notifyExpired, setNotifyExpired]               = useState(true)
  const [saved, setSaved]                               = useState(false)

  useEffect(() => {
    if (config) {
      setWebhookUrl(config.webhookUrl ?? '')
      setNotifyAmountMismatch(config.notifyAmountMismatch)
      setNotifyDuplicate(config.notifyDuplicatePayment)
      setNotifyNoCharge(config.notifyPaymentWithoutCharge)
      setNotifyExpired(config.notifyExpiredChargePaid)
    }
  }, [config])

  const { mutate, isPending } = useMutation({
    mutationFn: (req: UpdateAlertConfigRequest) => settingsService.updateAlertConfig(req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alert-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function handleSave() {
    mutate({
      webhookUrl: webhookUrl.trim() || null,
      notifyAmountMismatch,
      notifyDuplicatePayment:     notifyDuplicate,
      notifyPaymentWithoutCharge: notifyNoCharge,
      notifyExpiredChargePaid:    notifyExpired,
    })
  }

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center justify-between cursor-pointer py-2 border-b border-gray-800/60 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={!isAdmin}
        className={[
          'relative w-9 h-5 rounded-full transition-colors focus:outline-none',
          checked ? 'bg-indigo-600' : 'bg-gray-700',
          !isAdmin ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <span className={[
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')} />
      </button>
    </label>
  )

  if (isLoading) return <LoadingState />
  if (isError)   return <ErrorState message="Erro ao carregar configurações." onRetry={() => {}} />

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={16} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-gray-200">Notificações de Divergência</h2>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        Quando uma divergência é detectada, o RECIX envia um HTTP POST para a URL configurada.
        Ideal para integrar com Slack, PagerDuty, ou o ERP da sua empresa.
      </p>

      {!isAdmin && (
        <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400">
          Apenas Owner/Admin pode alterar as configurações de alerta.
        </div>
      )}

      <div className="mb-5">
        <label className="block text-xs text-gray-500 mb-1.5">URL do webhook (https://...)</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            disabled={!isAdmin}
            placeholder="https://meu-sistema.com.br/webhooks/recix"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 px-3 py-2 placeholder:text-gray-600 disabled:opacity-50"
          />
          {webhookUrl && (
            <a href={webhookUrl} target="_blank" rel="noopener noreferrer"
              className="p-2 text-gray-500 hover:text-indigo-400 border border-gray-700 rounded-lg transition-colors">
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Payload enviado: JSON com <code className="text-gray-500">event</code>,{' '}
          <code className="text-gray-500">status</code>, <code className="text-gray-500">chargeId</code>,{' '}
          <code className="text-gray-500">expectedAmount</code>, <code className="text-gray-500">paidAmount</code>,{' '}
          <code className="text-gray-500">reason</code>.
        </p>
      </div>

      <div className="mb-5">
        <p className="text-xs text-gray-500 mb-2">Notificar em</p>
        <Toggle checked={notifyAmountMismatch} onChange={setNotifyAmountMismatch} label="Valor divergente (AmountMismatch)" />
        <Toggle checked={notifyDuplicate} onChange={setNotifyDuplicate} label="Pagamento duplicado (DuplicatePayment)" />
        <Toggle checked={notifyNoCharge} onChange={setNotifyNoCharge} label="Sem cobrança correspondente (PaymentWithoutCharge)" />
        <Toggle checked={notifyExpired} onChange={setNotifyExpired} label="Cobrança expirada paga (ExpiredChargePaid)" />
      </div>

      {config?.updatedAt && (
        <p className="text-xs text-gray-600 mb-4">
          Última atualização: {formatDateTime(config.updatedAt)}
        </p>
      )}

      {isAdmin && (
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <CheckCircle size={14} className="text-green-400" />
          ) : (
            <Settings size={14} />
          )}
          {saved ? 'Salvo!' : isPending ? 'Salvando...' : 'Salvar configurações'}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  return (
    <div>
      <Header
        title="Configurações"
        subtitle="Fechamento financeiro e notificações proativas de divergência"
      />
      <ClosingReportSection />
      <AlertConfigSection />
    </div>
  )
}
