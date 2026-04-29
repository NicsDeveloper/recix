import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  CreditCard,
  Zap,
  GitMerge,
  PlayCircle,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { dashboardService } from '../../services/dashboardService'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Cobranças', icon: CreditCard, to: '/charges' },
  { label: 'Eventos de Pagamento', icon: Zap, to: '/payment-events' },
  { label: 'Conciliações', icon: GitMerge, to: '/reconciliations' },
  { label: 'Simulador PIX', icon: PlayCircle, to: '/webhooks/simulator' },
]

export function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800 flex-shrink-0">
        <span className="text-lg font-bold text-white tracking-tight">
          RE<span className="text-indigo-400">CIX</span>
        </span>
        <span className="ml-2 text-xs text-gray-500 font-medium uppercase tracking-wider">
          Engine
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 pl-[10px]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border-l-2 border-transparent pl-[10px]',
              ].join(' ')
            }
          >
            <Icon size={15} className="flex-shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* API Status */}
      <div className="p-4 border-t border-gray-800 flex-shrink-0">
        <ApiStatus />
      </div>
    </aside>
  )
}

function ApiStatus() {
  const { isSuccess, isError, isFetching } = useQuery({
    queryKey: ['api-health'],
    queryFn: () => dashboardService.getSummary(),
    staleTime: 60_000,
    retry: false,
    refetchInterval: 30_000,
  })

  const online = isSuccess && !isError

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      {online ? (
        <Wifi size={12} className="text-green-500" />
      ) : (
        <WifiOff size={12} className="text-red-500" />
      )}
      <span>Status da API</span>
      <span className="ml-auto flex items-center gap-1.5">
        {isFetching ? (
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        ) : online ? (
          <span className="w-2 h-2 rounded-full bg-green-500" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-red-500" />
        )}
        <span className={online ? 'text-green-500' : isError ? 'text-red-400' : 'text-gray-500'}>
          {isFetching ? 'verificando' : online ? 'online' : 'offline'}
        </span>
      </span>
    </div>
  )
}
