/* eslint react-refresh/only-export-components: 0 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { UserDto, OrgMembershipDto, JoinRequestDto } from '../types'
import { authService } from '../services/authService'

const TOKEN_KEY   = 'recix_token'
const USER_KEY    = 'recix_user'
const ORGS_KEY    = 'recix_orgs'
const PENDING_KEY = 'recix_pending_join'

interface AuthContextValue {
  user:               UserDto | null
  token:              string | null
  organizations:      OrgMembershipDto[]
  currentOrg:         OrgMembershipDto | null
  pendingJoinRequest: JoinRequestDto | null
  isLoading:          boolean
  login:              (token: string, user: UserDto, orgs?: OrgMembershipDto[], pending?: JoinRequestDto | null) => void
  logout:             () => void
  refreshAuth:        () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readLocal<T>(key: string): T | null {
  try {
    const val = localStorage.getItem(key)
    return val ? (JSON.parse(val) as T) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  })

  const [user, setUser] = useState<UserDto | null>(() => readLocal<UserDto>(USER_KEY))

  const [organizations, setOrganizations] = useState<OrgMembershipDto[]>(
    () => readLocal<OrgMembershipDto[]>(ORGS_KEY) ?? []
  )

  const [pendingJoinRequest, setPendingJoinRequest] = useState<JoinRequestDto | null>(
    () => readLocal<JoinRequestDto>(PENDING_KEY)
  )

  const isLoading = false

  const currentOrg = organizations.find(o => o.isCurrent) ?? organizations[0] ?? null

  const login = useCallback((
    newToken: string,
    newUser: UserDto,
    orgs: OrgMembershipDto[] = [],
    pending: JoinRequestDto | null = null,
  ) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    localStorage.setItem(ORGS_KEY, JSON.stringify(orgs))
    if (pending) localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    else         localStorage.removeItem(PENDING_KEY)
    setToken(newToken)
    setUser(newUser)
    setOrganizations(orgs)
    setPendingJoinRequest(pending)
  }, [])

  const refreshAuth = useCallback(async () => {
    try {
      const res = await authService.refresh()
      localStorage.setItem(TOKEN_KEY, res.token)
      localStorage.setItem(USER_KEY, JSON.stringify(res.user))
      localStorage.setItem(ORGS_KEY, JSON.stringify(res.organizations))
      if (res.pendingJoinRequest) localStorage.setItem(PENDING_KEY, JSON.stringify(res.pendingJoinRequest))
      else                        localStorage.removeItem(PENDING_KEY)
      setToken(res.token)
      setUser(res.user)
      setOrganizations(res.organizations)
      setPendingJoinRequest(res.pendingJoinRequest ?? null)
    } catch {
      // token expirado ou inválido — deixa o usuário na tela atual
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ORGS_KEY)
    localStorage.removeItem(PENDING_KEY)
    setToken(null)
    setUser(null)
    setOrganizations([])
    setPendingJoinRequest(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, organizations, currentOrg, pendingJoinRequest, isLoading, login, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
