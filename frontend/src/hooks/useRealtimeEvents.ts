import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL } from '../config/env'

interface RecixEvent {
  type: string
  entityId?: string
}

/**
 * Conecta ao endpoint SSE /events/stream e invalida as queries
 * do TanStack Query conforme os eventos recebidos.
 *
 * Montado globalmente em App.tsx — reconecta automaticamente
 * se a conexão cair (EventSource faz isso nativamente).
 */
export function useRealtimeEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const streamUrl = `${API_BASE_URL}/events/stream`
    const es = new EventSource(streamUrl)

    es.onopen = () => {
      console.debug('[SSE] Conectado ao stream de eventos.')
    }

    es.onmessage = (e) => {
      try {
        const event: RecixEvent = JSON.parse(e.data)
        console.debug('[SSE] Evento recebido:', event)
        handleEvent(event, queryClient)
      } catch {
        // heartbeat ou mensagem não-JSON — ignorar
      }
    }

    es.onerror = () => {
      // EventSource reconecta automaticamente — não é necessário fazer nada
      console.debug('[SSE] Conexão perdida, reconectando...')
    }

    return () => {
      es.close()
      console.debug('[SSE] Conexão encerrada.')
    }
  }, [queryClient])
}

function handleEvent(event: RecixEvent, queryClient: ReturnType<typeof useQueryClient>) {
  switch (event.type) {
    case 'charge.updated':
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      if (event.entityId) {
        queryClient.invalidateQueries({ queryKey: ['charge', event.entityId] })
        queryClient.invalidateQueries({ queryKey: ['reconciliations-by-charge', event.entityId] })
      }
      break

    case 'charges.expired':
      // Múltiplas cobranças expiraram — invalida tudo
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      break

    case 'payment_event.updated':
      queryClient.invalidateQueries({ queryKey: ['payment-events'] })
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      break

    case 'reconciliation.created':
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      break
  }
}
