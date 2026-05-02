import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as signalR from '@microsoft/signalr'
import { getStoredToken, useAuth } from '../contexts/AuthContext'

interface RecixSignalREvent {
  type:     string
  entityId: string | null
  orgId:    string | null
  userId:   string | null
  accepted: boolean | null
}

/**
 * Conecta ao DashboardHub via SignalR e invalida queries do TanStack Query
 * conforme os eventos recebidos da organização do usuário.
 * Reconecta automaticamente com back-off exponencial.
 */
export function useDashboardRealtime() {
  const queryClient = useQueryClient()
  const { refreshAuth } = useAuth()
  const connRef     = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/dashboard', {
        accessTokenFactory: () => getStoredToken() ?? '',
        transport: signalR.HttpTransportType.WebSockets |
                   signalR.HttpTransportType.ServerSentEvents |
                   signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connRef.current = connection

    connection.on('RecixEvent', (evt: RecixSignalREvent) => {
      handleEvent(evt, queryClient, refreshAuth)
    })

    connection.onreconnected(() => {
      // Após reconexão, invalida tudo para garantir dados atualizados
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    })

    connection.start().catch((err) => {
      console.warn('[SignalR] Conexão falhou, tentando reconectar...', err)
    })

    return () => {
      connection.stop()
    }
  }, [queryClient, refreshAuth])
}

function handleEvent(
  evt: RecixSignalREvent,
  queryClient: ReturnType<typeof useQueryClient>,
  refreshAuth: () => Promise<void>,
) {
  switch (evt.type) {
    case 'charge.updated':
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      if (evt.entityId) {
        queryClient.invalidateQueries({ queryKey: ['charge', evt.entityId] })
      }
      break

    case 'charges.expired':
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      break

    case 'reconciliation.created':
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      break

    case 'payment_event.updated':
      queryClient.invalidateQueries({ queryKey: ['payment-events'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      break

    case 'join_request.reviewed':
      // Atualiza a sessão do usuário que estava aguardando aprovação.
      // refreshAuth busca novo JWT com org_id e atualiza o AuthContext —
      // o App.tsx re-renderiza e redireciona automaticamente para a dashboard.
      refreshAuth()
      queryClient.invalidateQueries({ queryKey: ['join-requests'] })
      break
  }
}
