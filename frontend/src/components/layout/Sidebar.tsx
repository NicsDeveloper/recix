import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ComponentType } from 'react'
import {
  LayoutDashboard,
  CreditCard,
  Zap,
  GitMerge,
  PlayCircle,
  FileText,
  Bell,
  Wifi,
  WifiOff,
  Settings,
  LogOut,
  Upload,
  Plug,
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
      /** Dica longa ao passar o mouse (acessibilidade). */
      title?: string
    }
  | { kind: 'placeholder'; label: string; icon: ComponentType<{ size?: number; className?: string }> }

const navItems: NavItem[] = [
  { kind: 'link', label: 'Dashboard', icon: LayoutDashboard, to: '/', end: true },
  {
    kind: 'link',
    label: 'Cobranças',
    icon: CreditCard,
    to: '/charges',
    title: 'Operacional: quem deve, quanto, vencimento e status da cobrança (antes do dinheiro “bater” no banco).',
  },
  { kind: 'link', label: 'Eventos de Pagamento', icon: Zap, to: '/payment-events', adminOnly: true },
  {
    kind: 'link',
    label: 'Conciliações',
    icon: GitMerge,
    to: '/reconciliations',
    title: 'Auditoria: extrato vs esperado, divergências e a verdade financeira após o recebimento.',
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
  { kind: 'link', label: 'Conexões',        icon: Plug,   to: '/connections' },
  {
    kind: 'link',
    label: 'Importar extratos',
    icon: Upload,
    to: '/import',
    title: 'CSV de vendas e extrato bancário (CSV ou OFX) — dois envios na mesma página',
  },
  { kind: 'link', label: 'Configurações', icon: Settings, to: '/settings' },
]

const SEEN_BADGES_KEY = 'recix_seen_badges'

function useSeenBadge(badgeId: string): [boolean, () => void] {
  const stored = () => {
    try { return JSON.parse(localStorage.getItem(SEEN_BADGES_KEY) ?? '[]') as string[] }
    catch { return [] }
  }
  const [seen, setSeen] = useState(() => stored().includes(badgeId))

  function markSeen() {
    if (seen) return
    const list = stored()
    if (!list.includes(badgeId)) localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify([...list, badgeId]))
    setSeen(true)
  }

  return [seen, markSeen]
}

export function Sidebar() {
  const { currentOrg } = useAuth()
  const location = useLocation()
  const [simulatorBadgeSeen, markSimulatorBadgeSeen] = useSeenBadge('simulador-pix')

  // Badge de solicitações pendentes — só para Owner/Admin
  const isAdmin = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['join-requests-count'],
    queryFn: () => organizationsService.getPendingCount(),
    enabled: isAdmin,
    staleTime: 30_000,
    refetchInterval: 120_000,
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
            RECIX <span className="text-gray-500 font-semibold">ENGINE</span>
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
          const linkTitle = item.kind === 'link' ? item.title : undefined
          const showBadge = item.badge && !(item.badge === 'Novo' && item.to === '/webhooks/simulator' && simulatorBadgeSeen)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={linkTitle}
              end={item.end ?? item.to === '/'}
              onClick={() => { if (item.badge === 'Novo' && item.to === '/webhooks/simulator') markSimulatorBadgeSeen() }}
              className={({ isActive }) => {
                const isDivergenciasNav = item.to.includes('filter=divergent')
                const hasDivergentFilter = new URLSearchParams(location.search).get('filter') === 'divergent'
                const activeState = isDivergenciasNav
                  ? isActive && hasDivergentFilter
                  : isActive && !hasDivergentFilter
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
              ) : showBadge ? (
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-md border border-green-500/20 bg-green-500/10 text-green-400">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 flex-shrink-0">
        <div className="px-4 pt-3 pb-2">
          <ApiStatus />
        </div>
        <div className="px-4 pb-3 border-t border-gray-800/60 pt-2">
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
    queryFn:  () => dashboardService.getSummary(),
    staleTime: 60_000,
    retry: false,
    refetchInterval: 120_000,
  })

  const online = isSuccess && !isError
  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'U'

  return (
    <div className="flex flex-col gap-3">
      {/* Status do sistema */}
      <div className="flex items-center gap-2">
        {online ? (
          <Wifi size={11} className="text-green-500 flex-shrink-0" />
        ) : (
          <WifiOff size={11} className="text-red-500 flex-shrink-0" />
        )}
        <span className="text-xs text-gray-500 flex-1 min-w-0 truncate">
          {online ? 'Sistema operacional' : 'Sistema offline'}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          isFetching ? 'bg-yellow-500 animate-pulse' : online ? 'bg-green-500' : 'bg-red-500'
        }`} />
      </div>

      {/* Usuário + org */}
      {user && (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-indigo-400">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-200 truncate leading-none" title={user.name}>
              {user.name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {currentOrg && (
                <span className="text-[10px] text-gray-500 truncate" title={currentOrg.name}>
                  {currentOrg.name}
                </span>
              )}
              {currentOrg && (
                <span className="text-[10px] text-indigo-400 flex-shrink-0">· {currentOrg.role}</span>
              )}
            </div>
            {organizations.length > 1 && (
              <p className="text-[10px] text-indigo-500 mt-0.5">
                +{organizations.length - 1} org{organizations.length > 2 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={logout}
            title="Sair da conta"
            className="flex-shrink-0 p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
