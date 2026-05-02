import { useState, useEffect, useRef } from 'react'
import { Building2, Search, Plus, LogOut, Loader2, CheckCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { organizationsService } from '../services/organizationsService'
import type { OrgSearchDto } from '../types'

type Step = 'choose' | 'create' | 'join'

export function OrgSetupPage() {
  const { user, login, logout } = useAuth()
  const [step, setStep]             = useState<Step>('choose')
  const [orgName, setOrgName]       = useState('')
  const [orgSearch, setOrgSearch]   = useState('')
  const [orgResults, setOrgResults] = useState<OrgSearchDto[]>([])
  const [selectedOrg, setSelectedOrg] = useState<OrgSearchDto | null>(null)
  const [joinMessage, setJoinMessage] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isPending, setIsPending]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const searchTimeout               = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (orgSearch.length < 2) { setOrgResults([]); return }
    clearTimeout(searchTimeout.current)
    setIsSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await organizationsService.search(orgSearch)
        setOrgResults(results)
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }, [orgSearch])

  async function handleCreate() {
    if (!orgName.trim()) { setError('Informe o nome da empresa.'); return }
    setError(null)
    setIsPending(true)
    try {
      const res = await organizationsService.setupCreate(orgName.trim())
      login(res.token, res.user, res.organizations, res.pendingJoinRequest)
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao criar empresa.')
    } finally {
      setIsPending(false)
    }
  }

  async function handleJoin() {
    if (!selectedOrg) { setError('Selecione uma empresa.'); return }
    setError(null)
    setIsPending(true)
    try {
      const res = await organizationsService.setupJoin(selectedOrg.id, joinMessage || undefined)
      login(res.token, res.user, res.organizations, res.pendingJoinRequest)
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao solicitar acesso.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-600/30">
            <span className="text-gray-50 text-2xl font-black tracking-tight">R</span>
          </div>
          <h1 className="text-xl font-bold text-gray-50">Bem-vindo, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-sm text-gray-500 mt-1">Configure sua empresa para continuar</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          {step === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-4">
                Como você quer usar o Recix?
              </p>

              <button
                onClick={() => setStep('create')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-700 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                  <Plus size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-200">Criar uma nova empresa</p>
                  <p className="text-xs text-gray-500 mt-0.5">Você será o administrador e poderá convidar membros</p>
                </div>
                <ArrowRight size={14} className="text-gray-600 group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
              </button>

              <button
                onClick={() => setStep('join')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-700 hover:border-green-500/50 hover:bg-green-500/5 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-green-500/20 transition-colors">
                  <Building2 size={18} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-200">Entrar em uma empresa existente</p>
                  <p className="text-xs text-gray-500 mt-0.5">Solicite acesso e aguarde a aprovação de um administrador</p>
                </div>
                <ArrowRight size={14} className="text-gray-600 group-hover:text-green-400 flex-shrink-0 transition-colors" />
              </button>
            </div>
          )}

          {step === 'create' && (
            <div>
              <button onClick={() => { setStep('choose'); setError(null) }}
                className="text-xs text-gray-500 hover:text-gray-300 mb-4 flex items-center gap-1 transition-colors">
                ← Voltar
              </button>
              <h2 className="text-base font-semibold text-gray-200 mb-4">Nome da sua empresa</h2>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Nome da empresa</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="Ex: Minha Empresa Ltda"
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleCreate}
                  disabled={isPending || !orgName.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {isPending ? <><Loader2 size={14} className="animate-spin" /> Criando…</> : <><CheckCircle size={14} /> Criar empresa</>}
                </button>
              </div>
            </div>
          )}

          {step === 'join' && (
            <div>
              <button onClick={() => { setStep('choose'); setError(null); setSelectedOrg(null); setOrgSearch('') }}
                className="text-xs text-gray-500 hover:text-gray-300 mb-4 flex items-center gap-1 transition-colors">
                ← Voltar
              </button>
              <h2 className="text-base font-semibold text-gray-200 mb-4">Buscar empresa</h2>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    value={orgSearch}
                    onChange={e => { setOrgSearch(e.target.value); setSelectedOrg(null) }}
                    placeholder="Digite o nome da empresa…"
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    autoFocus
                  />
                  {isSearching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />}
                </div>

                {orgResults.length > 0 && !selectedOrg && (
                  <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden divide-y divide-gray-700">
                    {orgResults.map(org => (
                      <button
                        key={org.id}
                        onClick={() => { setSelectedOrg(org); setOrgSearch(org.name) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors text-left"
                      >
                        <Building2 size={14} className="text-gray-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-200 font-medium truncate">{org.name}</p>
                          <p className="text-xs text-gray-500">@{org.slug} · {org.memberCount} membro{org.memberCount !== 1 ? 's' : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedOrg && (
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2.5 flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                    <p className="text-sm text-green-300 font-medium truncate">{selectedOrg.name}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Mensagem para o administrador <span className="text-gray-600">(opcional)</span>
                  </label>
                  <textarea
                    value={joinMessage}
                    onChange={e => setJoinMessage(e.target.value)}
                    placeholder="Ex: Sou do time de finanças e preciso de acesso…"
                    rows={2}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>

                <button
                  onClick={handleJoin}
                  disabled={isPending || !selectedOrg}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {isPending ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : 'Solicitar acesso'}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          className="w-full mt-4 flex items-center justify-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          <LogOut size={12} /> Sair da conta
        </button>
      </div>
    </div>
  )
}
