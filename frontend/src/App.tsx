import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { PendingApprovalPage } from './pages/PendingApprovalPage'
import { OrgSetupPage } from './pages/OrgSetupPage'
import { JoinRequestsPage } from './pages/JoinRequestsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ChargesPage } from './pages/ChargesPage'
import { ChargeDetailPage } from './pages/ChargeDetailPage'
import { PaymentEventsPage } from './pages/PaymentEventsPage'
import { ReconciliationsPage } from './pages/ReconciliationsPage'
import { AlertsPage } from './pages/AlertsPage'
import { ReportsPage } from './pages/ReportsPage'
import { ImportPage } from './pages/ImportPage'
import { ConnectionsPage } from './pages/ConnectionsPage'
import { SettingsPage } from './pages/SettingsPage'
import { useRealtimeEvents } from './hooks/useRealtimeEvents'
import { useDashboardRealtime } from './hooks/useDashboardRealtime'
import { LoadingState } from './components/ui/LoadingState'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AppCore />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  )
}

/** Componente interno para poder usar hooks do QueryClient e Auth */
function AppCore() {
  const { user, isLoading, organizations, pendingJoinRequest } = useAuth()
  useRealtimeEvents()        // SSE — stream de eventos bruto (mantido para compatibilidade)
  useDashboardRealtime()     // SignalR — invalidação de queries por org

  if (isLoading) return <LoadingState />

  // Usuário logado mas sem org e sem solicitação → precisa configurar empresa
  if (user && organizations.length === 0 && !pendingJoinRequest) {
    return <OrgSetupPage />
  }

  // Usuário logado com solicitação pendente → aguardando aprovação
  if (user && organizations.length === 0 && pendingJoinRequest) {
    return <PendingApprovalPage />
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota de login — sem layout */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

        {/* Rotas protegidas — com layout */}
        <Route
          element={!user ? <Navigate to="/login" replace /> : <AppLayout />}
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/charges" element={<ChargesPage />} />
          <Route path="/charges/:id" element={<ChargeDetailPage />} />
          <Route path="/payment-events" element={<PaymentEventsPage />} />
          <Route path="/reconciliations" element={<ReconciliationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/webhooks/simulator" element={<Navigate to="/connections?tab=dev" replace />} />
          <Route path="/join-requests" element={<JoinRequestsPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
