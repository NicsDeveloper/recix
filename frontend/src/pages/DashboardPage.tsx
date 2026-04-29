import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Copy,
  Ban,
  XCircle,
} from 'lucide-react'
import { dashboardService } from '../services/dashboardService'
import { StatCard } from '../components/ui/StatCard'
import { LoadingState } from '../components/ui/LoadingState'
import { ErrorState } from '../components/ui/ErrorState'
import { Header } from '../components/layout/Header'
import { formatCurrency } from '../lib/formatters'
import type { DashboardSummary } from '../types'

// ─── Reconciliation chart data ─────────────────────────────────────────────

function buildChartData(summary: DashboardSummary) {
  return [
    { name: 'Conciliado', value: summary.paidCharges, color: '#22c55e' },
    { name: 'Valor Divergente', value: summary.reconciliationIssues.amountMismatch, color: '#ef4444' },
    { name: 'Duplicado', value: summary.reconciliationIssues.duplicatePayment, color: '#f97316' },
    { name: 'Sem Cobrança', value: summary.reconciliationIssues.paymentWithoutCharge, color: '#ef4444' },
    { name: 'Expirado Pago', value: summary.reconciliationIssues.expiredChargePaid, color: '#f97316' },
    { name: 'Ref. Inválida', value: summary.reconciliationIssues.invalidReference, color: '#ef4444' },
    { name: 'Erro Proc.', value: summary.reconciliationIssues.processingError, color: '#6b7280' },
  ]
}

// ─── Custom tooltip ───────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-gray-300 font-medium">{label}</p>
      <p className="text-white font-bold">{payload[0].value}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardService.getSummary(),
    staleTime: 30_000,
  })

  if (isLoading) return <LoadingState />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    )
  }

  const summary = data!
  const chartData = buildChartData(summary)

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Visão geral do estado financeiro da engine"
        action={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 hover:text-gray-200 transition-colors"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        }
      />

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total de Cobranças"
          value={summary.totalCharges}
          icon={<CreditCard size={16} />}
          trend="neutral"
        />
        <StatCard
          title="Cobranças Pagas"
          value={summary.paidCharges}
          icon={<CheckCircle size={16} />}
          trend="success"
        />
        <StatCard
          title="Cobranças Pendentes"
          value={summary.pendingCharges}
          icon={<Clock size={16} />}
          trend="warning"
        />
        <StatCard
          title="Cobranças Divergentes"
          value={summary.divergentCharges}
          icon={<AlertTriangle size={16} />}
          trend="danger"
        />
        <StatCard
          title="Valor Total Recebido"
          value={formatCurrency(summary.totalReceivedAmount)}
          icon={<DollarSign size={16} />}
          trend="success"
        />
        <StatCard
          title="Valor Divergente"
          value={formatCurrency(summary.totalDivergentAmount)}
          icon={<TrendingDown size={16} />}
          trend={summary.totalDivergentAmount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {/* Reconciliation Issues */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Problemas de Conciliação
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <IssueCard
            label="Valor Divergente"
            count={summary.reconciliationIssues.amountMismatch}
            icon={<AlertTriangle size={14} />}
            color="red"
          />
          <IssueCard
            label="Pag. Duplicado"
            count={summary.reconciliationIssues.duplicatePayment}
            icon={<Copy size={14} />}
            color="orange"
          />
          <IssueCard
            label="Sem Cobrança"
            count={summary.reconciliationIssues.paymentWithoutCharge}
            icon={<Ban size={14} />}
            color="red"
          />
          <IssueCard
            label="Expirada Paga"
            count={summary.reconciliationIssues.expiredChargePaid}
            icon={<XCircle size={14} />}
            color="orange"
          />
        </div>
      </div>

      {/* Bar Chart */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">
          Distribuição por Status de Conciliação
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── IssueCard ────────────────────────────────────────────────────────────

interface IssueCardProps {
  label: string
  count: number
  icon: React.ReactNode
  color: 'red' | 'orange'
}

const issueColors = {
  red: {
    bg: 'bg-red-500/10',
    icon: 'text-red-400',
    count: 'text-red-400',
    border: 'border-red-500/20',
  },
  orange: {
    bg: 'bg-orange-500/10',
    icon: 'text-orange-400',
    count: 'text-orange-400',
    border: 'border-orange-500/20',
  },
}

function IssueCard({ label, count, icon, color }: IssueCardProps) {
  const c = issueColors[color]
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex items-center gap-3`}>
      <span className={c.icon}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 truncate">{label}</p>
        <p className={`text-lg font-bold ${c.count}`}>{count}</p>
      </div>
    </div>
  )
}
