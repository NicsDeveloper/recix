import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Settings,
  Bell,
  CheckCircle,
  Loader2,
  ExternalLink,
  BarChart3,
  Users,
  Shield,
  Eye,
  Trash2,
  ChevronDown,
  ArrowRight,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { LoadingState } from '../components/ui/LoadingState'
import { ErrorState } from '../components/ui/ErrorState'
import { settingsService } from '../services/settingsService'
import { organizationsService } from '../services/organizationsService'
import { formatDateTime } from '../lib/formatters'
import { useAuth } from '../contexts/AuthContext'
import type { MemberDto, UpdateAlertConfigRequest } from '../types'


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

const ROLE_META: Record<string, { label: string; icon: React.ReactElement | null; color: string }> = {
  Owner:  { label: 'Proprietário', icon: <Shield size={13} />,  color: 'text-amber-400' },
  Admin:  { label: 'Administrador', icon: <Shield size={13} />, color: 'text-indigo-400' },
  Member: { label: 'Membro',        icon: <Users  size={13} />, color: 'text-green-400' },
  Viewer: { label: 'Visualizador',  icon: <Eye    size={13} />, color: 'text-gray-400' },
}

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? { label: role, icon: null, color: 'text-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  )
}

function MemberRow({ member, isSelf, isOwner }: { member: MemberDto; isSelf: boolean; isOwner: boolean }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const updateRole = useMutation({
    mutationFn: (role: string) => organizationsService.updateMemberRole(member.userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members'] }),
  })

  const remove = useMutation({
    mutationFn: () => organizationsService.removeMember(member.userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members'] }),
  })

  const editable = !isSelf && member.role !== 'Owner' && isOwner
  const initials = member.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-gray-800/60 last:border-0">
      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
        <span className="text-[11px] font-bold text-indigo-400">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">
          {member.name} {isSelf && <span className="text-xs text-gray-500 font-normal">(você)</span>}
        </p>
        <p className="text-xs text-gray-500 truncate">{member.email}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {editable ? (
          <div className="relative">
            <button
              onClick={() => setOpen(v => !v)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              disabled={updateRole.isPending}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RoleBadge role={member.role} />
              <ChevronDown size={11} />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-10 overflow-hidden">
                {(['Admin', 'Member', 'Viewer'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => { updateRole.mutate(r); setOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                      r === member.role ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <RoleBadge role={r} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <RoleBadge role={member.role} />
        )}

        {editable && (
          <button
            onClick={() => { if (confirm(`Remover ${member.name} da organização?`)) remove.mutate() }}
            disabled={remove.isPending}
            title="Remover membro"
            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

function MembersSection() {
  const { user, currentOrg } = useAuth()
  const isOwnerOrAdmin = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'
  const isOwner = currentOrg?.role === 'Owner'

  const { data: members = [], isLoading } = useQuery<MemberDto[]>({
    queryKey: ['org-members'],
    queryFn: () => organizationsService.getMembers(),
    enabled: isOwnerOrAdmin,
    staleTime: 30_000,
  })

  if (!isOwnerOrAdmin) return null

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
        <Users size={16} className="text-indigo-400" />
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Membros da organização</h2>
          <p className="text-xs text-gray-500 mt-0.5">Gerencie papéis e acessos dos membros</p>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">Carregando membros…</div>
      ) : members.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">Nenhum membro encontrado.</div>
      ) : (
        <div>
          {members.map(m => (
            <MemberRow
              key={m.userId}
              member={m}
              isSelf={m.userId === user?.id}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <Header
        title="Configurações"
        subtitle="Notificações de divergência e gestão de membros da organização"
      />

      {/* Relatório de fechamento — atalho para a página dedicada */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <BarChart3 size={13} /> Fechamento
        </h2>
        <Link
          to="/reports"
          className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 hover:bg-gray-800/60 hover:border-gray-700 transition-all group"
        >
          <div>
            <p className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
              Relatório de fechamento do período
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Esperado vs. recebido, divergências, taxa de conciliação e export em CSV / PDF.
            </p>
          </div>
          <ArrowRight size={16} className="text-gray-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
        </Link>
      </section>

      {/* Notificações */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Bell size={13} /> Notificações
        </h2>
        <AlertConfigSection />
      </section>

      {/* Membros */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users size={13} /> Membros
        </h2>
        <MembersSection />
      </section>
    </div>
  )
}
