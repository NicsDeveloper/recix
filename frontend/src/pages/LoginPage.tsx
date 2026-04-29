import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { Loader2, LogIn, UserPlus, Building2, Plus, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { authService } from '../services/authService'
import { organizationsService } from '../services/organizationsService'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import type { OrgSearchDto } from '../types'

type Mode = 'login' | 'register'

export function LoginPage() {
  const { login } = useAuth()
  const { theme } = useTheme()
  const navigate  = useNavigate()

  type RegisterMode = 'create' | 'join'

  const [mode, setMode]               = useState<Mode>('login')
  const [email, setEmail]             = useState('')
  const [name, setName]               = useState('')
  const [orgName, setOrgName]         = useState('')
  const [password, setPassword]       = useState('')
  const [registerMode, setRegisterMode] = useState<RegisterMode>('create')
  const [orgSearch, setOrgSearch]     = useState('')
  const [orgResults, setOrgResults]   = useState<OrgSearchDto[]>([])
  const [selectedOrg, setSelectedOrg] = useState<OrgSearchDto | null>(null)
  const [joinMessage, setJoinMessage] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isPending, setIsPending]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const searchTimeout                 = useRef<ReturnType<typeof setTimeout>>(undefined)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)
    try {
      const response = mode === 'login'
        ? await authService.login(email, password)
        : registerMode === 'create'
          ? await authService.register(email, name, password, orgName)
          : await authService.register(email, name, password, undefined, selectedOrg?.id, joinMessage)
      login(response.token, response.user, response.organizations, response.pendingJoinRequest)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao autenticar.')
    } finally {
      setIsPending(false)
    }
  }

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return
    setError(null)
    setIsPending(true)
    try {
      const response = await authService.googleAuth(credentialResponse.credential)
      login(response.token, response.user, response.organizations, response.pendingJoinRequest)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao autenticar com Google.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle size="sm" />
      </div>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-600/30">
            <span className="text-gray-50 text-2xl font-black tracking-tight">R</span>
          </div>
          <h1 className="text-xl font-bold text-gray-50">RECIX Engine</h1>
          <p className="text-sm text-gray-500 mt-1">Plataforma de conciliação PIX</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          {/* Tabs */}
          <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-gray-700 text-gray-50 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <LogIn size={14} />
              Entrar
            </button>
            <button
              onClick={() => { setMode('register'); setError(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'bg-gray-700 text-gray-50 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <UserPlus size={14} />
              Criar conta
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Seu nome</label>
                  <input
                    type="text"
                    placeholder="João Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                  />
                </div>

                {/* Toggle criar / entrar em empresa */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Empresa</label>
                  <div className="flex rounded-lg bg-gray-800 p-1 mb-3">
                    <button
                      type="button"
                      onClick={() => setRegisterMode('create')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        registerMode === 'create' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <Plus size={12} /> Criar empresa
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterMode('join')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        registerMode === 'join' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <Building2 size={12} /> Solicitar acesso
                    </button>
                  </div>

                  {registerMode === 'create' ? (
                    <input
                      type="text"
                      placeholder="Minha Empresa Ltda"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                    />
                  ) : (
                    <div className="space-y-2">
                      {/* Busca de empresa */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Buscar empresa por nome..."
                          value={selectedOrg ? selectedOrg.name : orgSearch}
                          onChange={(e) => { setOrgSearch(e.target.value); setSelectedOrg(null) }}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                        />
                        {isSearching && (
                          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />
                        )}
                      </div>

                      {/* Resultados da busca */}
                      {orgResults.length > 0 && !selectedOrg && (
                        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                          {orgResults.map(org => (
                            <button
                              key={org.id}
                              type="button"
                              onClick={() => { setSelectedOrg(org); setOrgResults([]) }}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-700 transition-colors text-left"
                            >
                              <div>
                                <p className="text-gray-200 font-medium">{org.name}</p>
                                <p className="text-gray-500 text-xs">@{org.slug} · {org.memberCount} membro(s)</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedOrg && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                          <Building2 size={14} className="text-indigo-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-indigo-300 font-medium truncate">{selectedOrg.name}</p>
                            <p className="text-xs text-gray-500">@{selectedOrg.slug}</p>
                          </div>
                          <button type="button" onClick={() => { setSelectedOrg(null); setOrgSearch('') }} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                        </div>
                      )}

                      {/* Mensagem opcional */}
                      {selectedOrg && (
                        <textarea
                          placeholder="Mensagem para o administrador (opcional)"
                          value={joinMessage}
                          onChange={(e) => setJoinMessage(e.target.value)}
                          rows={2}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                        />
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Senha</label>
              <input
                type="password"
                placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : mode === 'login' ? (
                <LogIn size={15} />
              ) : (
                <UserPlus size={15} />
              )}
              {isPending
                ? 'Aguarde...'
                : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">ou continue com</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Google Login */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Erro ao autenticar com Google. Tente novamente.')}
              theme={theme === 'light' ? 'outline' : 'filled_black'}
              size="large"
              text={mode === 'login' ? 'signin_with' : 'signup_with'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
