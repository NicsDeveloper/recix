import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import {
  LayoutDashboard,
  CreditCard,
  Zap,
  GitMerge,
  PlayCircle,
  AlertTriangle,
  FileText,
  Bell,
  Wifi,
  WifiOff,
  Settings,
  LogOut,
} from 'lucide-react'
import { dashboardService } from '../../services/dashboardService'
import { organizationsService } from '../../services/organizationsService'
import { useAuth } from '../../contexts/AuthContext'
import { ThemeToggle } from './ThemeToggle'

type NavItem =
  | {
      kind: 'link'
      label: string
      icon: ComponentType<{ size?: number; className?: string }>
      to: string
      badge?: string
      end?: boolean
      adminOnly?: boolean
    }
  | { kind: 'placeholder'; label: string; icon: ComponentType<{ size?: number; className?: string }> }

const navItems: NavItem[] = [
  { kind: 'link', label: 'Dashboard', icon: LayoutDashboard, to: '/', end: true },
  { kind: 'link', label: 'Cobranças', icon: CreditCard, to: '/charges' },
  { kind: 'link', label: 'Eventos de Pagamento', icon: Zap, to: '/payment-events' },
  { kind: 'link', label: 'Conciliações', icon: GitMerge, to: '/reconciliations' },
  {
    kind: 'link',
    label: 'Divergências',
    icon: AlertTriangle,
    to: '/reconciliations?status=AmountMismatch',
  },
  {
    kind: 'link',
    label: 'Simulador PIX',
    icon: PlayCircle,
    to: '/webhooks/simulator',
    badge: 'Novo',
    adminOnly: true,
  },
  { kind: 'link', label: 'Relatórios', icon: FileText, to: '/reports' },
  { kind: 'link', label: 'Alertas', icon: Bell, to: '/alerts' },
  { kind: 'placeholder', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  const { currentOrg } = useAuth()
  const location = useLocation()

  // Badge de solicitações pendentes — só para Owner/Admin
  const isAdmin = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['join-requests-count'],
    queryFn: () => organizationsService.getPendingCount(),
    enabled: isAdmin,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  return (
    <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl border border-gray-800 flex items-center justify-center">
          <span className="text-lg font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 text-transparent bg-clip-text">
            R
          </span>
        </div>
        <div className="ml-3 min-w-0">
          <span className="text-sm font-bold text-gray-50 tracking-tight block leading-none">
            RECIX
          </span>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider block leading-none mt-1">
            Engine
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.kind === 'link' && item.adminOnly && !isAdmin) return null

          if (item.kind === 'placeholder') {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 border-l-2 border-transparent cursor-default"
              >
                <Icon size={15} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
            )
          }

          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? item.to === '/'}
              className={({ isActive }) => {
                const requiresAmountMismatchQuery = item.to.includes('?status=AmountMismatch')
                const hasAmountMismatchQuery = new URLSearchParams(location.search).get('status') === 'AmountMismatch'
                const activeState = requiresAmountMismatchQuery ? isActive && hasAmountMismatchQuery : isActive && !hasAmountMismatchQuery
                return [
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  activeState
                    ? 'bg-green-500/10 text-green-500 border-l-2 border-green-500/30 pl-[10px]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border-l-2 border-transparent pl-[10px]',
                ].join(' ')
              }}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.label === 'Alertas' && isAdmin && pendingCount > 0 ? (
                <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                  {pendingCount}
                </span>
              ) : item.badge ? (
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-md border border-green-500/20 bg-green-500/10 text-green-400">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      {/* API Status */}
      <div className="p-4 border-t border-gray-800 flex-shrink-0">
        <div className="space-y-4">
          <ApiStatus />
          <ThemeToggle size="sm" />
        </div>
      </div>
    </aside>
  )
}

function ApiStatus() {
  const { user, logout, currentOrg, organizations } = useAuth()
  const { isSuccess, isError, isFetching } = useQuery({
    queryKey: ['api-health'],
    queryFn: () => dashboardService.getSummary(),
    staleTime: 60_000,
    retry: false,
    refetchInterval: 30_000,
  })

  const online = isSuccess && !isError
  const displayUser = user ? `${user.name} - ${user.role}` : 'Dev Recix - Administrador'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {online ? (
          <Wifi size={12} className="text-green-500" />
        ) : (
          <WifiOff size={12} className="text-red-500" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-200 leading-none">Sistema Operacional</p>
          <p className="text-xs text-gray-500 mt-1">Todos os serviços online</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5">
          {isFetching ? (
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          ) : online ? (
            <span className="w-2 h-2 rounded-full bg-green-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-red-500" />
          )}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-gray-500">
          Versão: <span className="text-gray-400">MVP 1.0.0</span>
        </p>
        <p className="text-xs text-gray-500 truncate" title={displayUser}>
          Usuário: <span className="text-gray-400">{displayUser}</span>
        </p>
        {currentOrg && (
          <p className="text-xs text-gray-500 truncate" title={currentOrg.name}>
            Org: <span className="text-gray-400">{currentOrg.name}</span>
            <span className="ml-1 text-[10px] text-indigo-400">{currentOrg.role}</span>
          </p>
        )}
        {organizations.length > 1 && (
          <p className="text-xs text-indigo-500 mt-0.5">
            {organizations.length} organizações disponíveis
          </p>
        )}
      </div>

      {user && (
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors"
        >
          <LogOut size={12} />
          Sair da conta
        </button>
      )}
    </div>
  )
}
