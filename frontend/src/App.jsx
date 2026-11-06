import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import AuthPage from './pages/AuthPage.jsx'
import { CustomerLayout } from './components/dashboard/CustomerLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TicketsPage from './pages/TicketsPage.jsx'
import TicketDetailPage from './pages/TicketDetailPage.jsx'
import { restoreSession } from './features/auth/authSlice.js'
import { AdminLayout } from './components/admin/AdminLayout.jsx'
import AdminOverviewPage from './pages/admin/AdminOverviewPage.jsx'
import AdminTicketsPage from './pages/admin/AdminTicketsPage.jsx'
import AdminTicketDetailPage from './pages/admin/AdminTicketDetailPage.jsx'
import AdminPeoplePage from './pages/admin/AdminPeoplePage.jsx'
import AdminSettingsPage from './pages/admin/AdminSettingsPage.jsx'
import AdminAuditPage from './pages/admin/AdminAuditPage.jsx'
import { AgentLayout } from './components/agent/AgentLayout.jsx'
import AgentOverviewPage from './pages/agent/AgentOverviewPage.jsx'
import AgentTicketsPage from './pages/agent/AgentTicketsPage.jsx'
import AgentTicketDetailPage from './pages/agent/AgentTicketDetailPage.jsx'

function CustomerRoute() {
  const { user, status } = useSelector((state) => state.auth)
  if (status !== 'authenticated' || user?.role !== 'user') {
    return <Navigate to="/auth" replace />
  }
  return <CustomerLayout />
}

function AdminRoute() {
  const { user, status } = useSelector((state) => state.auth)
  if (status !== 'authenticated' || user?.role !== 'admin') {
    return <Navigate to="/auth" replace />
  }
  return <AdminLayout />
}

function AgentRoute() {
  const { user, status } = useSelector((state) => state.auth)
  if (status !== 'authenticated' || user?.role !== 'agent') {
    return <Navigate to="/auth" replace />
  }
  return <AgentLayout />
}

function App() {
  const dispatch = useDispatch()
  const authStatus = useSelector((state) => state.auth.status)
  const restoreStarted = useRef(false)

  useEffect(() => {
    if (restoreStarted.current) return
    restoreStarted.current = true
    dispatch(restoreSession())
  }, [dispatch])

  if (authStatus === 'restoring') {
    return <main className="session-loader"><span /><p>Restoring your session...</p></main>
  }

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<CustomerRoute />}>
        <Route path="/app" element={<DashboardPage />} />
        <Route path="/app/tickets" element={<TicketsPage />} />
        <Route path="/app/tickets/:ticketId" element={<TicketDetailPage />} />
      </Route>
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminOverviewPage />} />
        <Route path="/admin/tickets" element={<AdminTicketsPage />} />
        <Route path="/admin/tickets/:ticketId" element={<AdminTicketDetailPage />} />
        <Route path="/admin/users" element={<AdminPeoplePage kind="user" />} />
        <Route path="/admin/agents" element={<AdminPeoplePage kind="agent" />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
        <Route path="/admin/audit" element={<AdminAuditPage />} />
      </Route>
      <Route element={<AgentRoute />}>
        <Route path="/agent" element={<AgentOverviewPage />} />
        <Route path="/agent/tickets" element={<AgentTicketsPage />} />
        <Route path="/agent/tickets/:ticketId" element={<AgentTicketDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  )
}

export default App
