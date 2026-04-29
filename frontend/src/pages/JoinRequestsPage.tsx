import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserCheck, UserX, Clock, MessageSquare } from 'lucide-react'
import { organizationsService } from '../services/organizationsService'
import { LoadingState } from '../components/ui/LoadingState'
import { EmptyState } from '../components/ui/EmptyState'

export function JoinRequestsPage() {
  const queryClient = useQueryClient()

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['join-requests-pending'],
    queryFn: () => organizationsService.getPendingJoinRequests(),
    staleTime: 10_000,
  })

  const accept = useMutation({
    mutationFn: (id: string) => organizationsService.acceptJoinRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['join-requests-pending'] }),
  })

  const reject = useMutation({
    mutationFn: (id: string) => organizationsService.rejectJoinRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['join-requests-pending'] }),
  })

  if (isLoading) return <LoadingState />

  return (
    <div>
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
            <div
              key={req.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Info do usuário */}
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

                {/* Ações */}
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
                    onClick={() => accept.mutate(req.id)}
                    disabled={accept.isPending || reject.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-400 border border-green-500/20 bg-green-500/5 rounded-lg hover:bg-green-500/10 transition-colors disabled:opacity-50"
                  >
                    <UserCheck size={13} />
                    Aceitar
                  </button>
                </div>
              </div>

              {/* Mensagem */}
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
