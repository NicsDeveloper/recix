import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserCheck, UserX, Clock, MessageSquare, Shield, Users, Eye, X } from 'lucide-react'
import { useState } from 'react'
import { organizationsService } from '../services/organizationsService'
import { LoadingState } from '../components/ui/LoadingState'
import { EmptyState } from '../components/ui/EmptyState'
import type { JoinRequestDto } from '../types'

const ROLES = [
  {
    value: 'Admin',
    label: 'Administrador',
    description: 'Pode gerenciar membros, configurações e todos os dados da organização.',
    icon: Shield,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/30',
  },
  {
    value: 'Member',
    label: 'Membro',
    description: 'Pode visualizar e operar cobranças, conciliações e extratos.',
    icon: Users,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
  },
  {
    value: 'Viewer',
    label: 'Visualizador',
    description: 'Acesso somente leitura. Não pode criar ou alterar dados.',
    icon: Eye,
    color: 'text-gray-400',
    bg: 'bg-gray-500/10 border-gray-500/30',
  },
] as const

type Role = typeof ROLES[number]['value']

function AcceptModal({
  req,
  onConfirm,
  onClose,
  isPending,
}: {
  req: JoinRequestDto
  onConfirm: (role: Role) => void
  onClose: () => void
  isPending: boolean
}) {
  const [selectedRole, setSelectedRole] = useState<Role>('Member')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
          <X size={15} />
        </button>

        <h2 className="text-base font-bold text-white mb-1">Definir escopo do membro</h2>
        <p className="text-sm text-gray-400 mb-5">
          Escolha o papel de <span className="text-white font-medium">{req.userName}</span> antes de aceitar a solicitação.
        </p>

        <div className="space-y-2.5 mb-6">
          {ROLES.map(role => {
            const Icon = role.icon
            const selected = selectedRole === role.value
            return (
              <button
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  selected ? role.bg + ' border-opacity-100' : 'border-gray-800 hover:bg-gray-800/50'
                }`}
              >
                <Icon size={16} className={`flex-shrink-0 mt-0.5 ${selected ? role.color : 'text-gray-500'}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-none mb-1 ${selected ? role.color : 'text-gray-300'}`}>
                    {role.label}
                  </p>
                  <p className="text-xs text-gray-500 leading-snug">{role.description}</p>
                </div>
                <div className={`ml-auto flex-shrink-0 w-4 h-4 rounded-full border-2 mt-0.5 ${
                  selected ? 'border-current bg-current/30 ' + role.color : 'border-gray-600'
                }`} />
              </button>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selectedRole)}
            disabled={isPending}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Aceitando…' : 'Confirmar e aceitar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function JoinRequestsPage() {
  const queryClient = useQueryClient()
  const [pendingAccept, setPendingAccept] = useState<JoinRequestDto | null>(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['join-requests-pending'],
    queryFn: () => organizationsService.getPendingJoinRequests(),
    staleTime: 10_000,
  })

  const accept = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      organizationsService.acceptJoinRequest(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['join-requests-pending'] })
      setPendingAccept(null)
    },
  })

  const reject = useMutation({
    mutationFn: (id: string) => organizationsService.rejectJoinRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['join-requests-pending'] }),
  })

  if (isLoading) return <LoadingState />

  return (
    <div>
      {pendingAccept && (
        <AcceptModal
          req={pendingAccept}
          onClose={() => setPendingAccept(null)}
          isPending={accept.isPending}
          onConfirm={(role) => accept.mutate({ id: pendingAccept.id, role })}
        />
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Solicitações de Acesso</h1>
        <p className="text-sm text-gray-500 mt-1">
          {requests.length === 0
            ? 'Nenhuma solicitação pendente'
            : `${requests.length} solicitação(ões) aguardando revisão`}
        </p>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={<UserCheck size={24} />}
          message="Nenhuma solicitação pendente no momento."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-400">
                    {req.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{req.userName}</p>
                    <p className="text-xs text-gray-500">{req.userEmail}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Clock size={11} className="text-gray-600" />
                      <span className="text-xs text-gray-500">
                        Solicitado em {new Date(req.requestedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => reject.mutate(req.id)}
                    disabled={accept.isPending || reject.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/20 bg-red-500/5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <UserX size={13} />
                    Rejeitar
                  </button>
                  <button
                    onClick={() => setPendingAccept(req)}
                    disabled={accept.isPending || reject.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-400 border border-green-500/20 bg-green-500/5 rounded-lg hover:bg-green-500/10 transition-colors disabled:opacity-50"
                  >
                    <UserCheck size={13} />
                    Aceitar
                  </button>
                </div>
              </div>

              {req.message && (
                <div className="mt-3 pt-3 border-t border-gray-800 flex items-start gap-2">
                  <MessageSquare size={13} className="text-gray-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-400 italic">"{req.message}"</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
