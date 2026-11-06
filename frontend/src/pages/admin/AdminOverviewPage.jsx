import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock3, Headphones, Ticket, Users } from 'lucide-react'
import { fetchAdminOverview } from '../../features/admin/adminSlice.js'
import { LoadingRows, StateMessage, TicketTable } from '../../components/dashboard/TicketUi.jsx'

function AdminOverviewPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { overview, status, error } = useSelector((state) => state.admin)
  const { summary } = overview

  useEffect(() => { dispatch(fetchAdminOverview()) }, [dispatch])

  const cards = [
    ['Total tickets', summary.total || 0, Ticket],
    ['Active tickets', (summary.open || 0) + (summary.pending || 0) + (summary.in_progress || 0), Clock3],
    ['Customers', overview.users, Users],
    ['Support agents', overview.agents, Headphones],
  ]

  return <main className="dashboard-content">
    <section className="page-title"><div><span>Operations overview</span><h1>Admin dashboard</h1><p>Monitor support demand, people and ticket progress.</p></div></section>
    <section className="admin-grid">{cards.map(([label, count, Icon]) => <article className="admin-stat" key={label}><header><small>{label}</small><span><Icon size={17} /></span></header><strong>{count}</strong><p>Current system total</p></article>)}</section>
    <section className="count-grid">
      <MiniCount label="Open" value={summary.open} icon={AlertCircle} />
      <MiniCount label="Pending" value={summary.pending} icon={Clock3} tone="amber" />
      <MiniCount label="In progress" value={summary.in_progress} icon={Clock3} tone="violet" />
      <MiniCount label="Resolved" value={summary.resolved} icon={CheckCircle2} tone="green" />
      <MiniCount label="Closed" value={summary.closed} icon={Ticket} tone="slate" />
      <MiniCount label="Reopened" value={summary.reopened} icon={AlertCircle} tone="rose" />
    </section>
    <section className="content-panel"><div className="panel-title"><div><h2>Recent tickets</h2><p>Newest requests across all customers</p></div><button onClick={() => navigate('/admin/tickets')}>View all</button></div>
      {status === 'loading' ? <LoadingRows /> : error ? <StateMessage title="Could not load overview" copy={error} /> : overview.recentTickets.length ? <TicketTable items={overview.recentTickets} onOpen={(id) => navigate(`/admin/tickets/${id}`)} /> : <StateMessage title="No tickets" copy="New support requests will appear here." />}
    </section>
  </main>
}

function MiniCount({ label, value = 0, icon: Icon, tone = '' }) {
  return <article className={`count-card ${tone}`}><span><Icon size={18} /></span><div><strong>{value}</strong><p>{label}</p></div></article>
}

export default AdminOverviewPage
