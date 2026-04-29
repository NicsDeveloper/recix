import { Clock, Building2, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

export function PendingApprovalPage() {
  const { pendingJoinRequest, logout } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      // Re-faz login para checar se foi aprovado
      // (usa o token atual para chamar /auth/me e re-verificar)
      // Como não temos senha aqui, apenas recarrega a página
      window.location.reload()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Ícone animado */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
          <Clock size={36} className="text-amber-400 animate-pulse" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Aguardando aprovação</h1>
        <p className="text-gray-400 text-sm mb-6">
          Sua solicitação foi enviada com sucesso. Um administrador irá revisá-la em breve.
        </p>

        {/* Card com detalhes da solicitação */}
        {pendingJoinRequest && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{pendingJoinRequest.orgName}</p>
                <p className="text-xs text-gray-500">@{pendingJoinRequest.orgSlug}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Status</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
                  Pendente
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Solicitado em</span>
                <span className="text-gray-300">
                  {new Date(pendingJoinRequest.requestedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              {pendingJoinRequest.message && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-500 mb-1">Sua mensagem</p>
                  <p className="text-xs text-gray-300 italic">"{pendingJoinRequest.message}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isRefreshing
              ? <><RefreshCw size={15} className="animate-spin" /> Verificando...</>
              : <><RefreshCw size={15} /> Verificar status</>
            }
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-400 border border-gray-800 rounded-lg hover:bg-gray-900 transition-colors"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-6">
          Você receberá acesso assim que um administrador aprovar sua solicitação.
        </p>
      </div>
    </div>
  )
}
