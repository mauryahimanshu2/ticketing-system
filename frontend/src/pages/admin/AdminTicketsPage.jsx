import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { fetchAdminTickets } from '../../features/admin/adminSlice.js'
import { LoadingRows, StateMessage, StatusBadge } from '../../components/dashboard/TicketUi.jsx'
import { formatDate } from '../../utils/date.js'
import { formatPersonName } from '../../utils/name.js'

function AdminTicketsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { tickets, status, error } = useSelector((state) => state.admin)
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', page: 1 })

  useEffect(() => {
    const timer = setTimeout(() => dispatch(fetchAdminTickets({
      page: filters.page,
      limit: 20,
      ...(filters.search.trim() && { search: filters.search.trim() }),
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
    })), 250)
    return () => clearTimeout(timer)
  }, [dispatch, filters])

  function update(name, value) {
    setFilters((current) => ({ ...current, [name]: value, ...(name !== 'page' ? { page: 1 } : {}) }))
  }

  return <main className="dashboard-content"><section className="page-title"><div><span>Support operations</span><h1>All tickets</h1><p>Review and manage every customer request.</p></div></section>
    <section className="content-panel"><div className="admin-toolbar"><label><Search size={15} /><input value={filters.search} placeholder="Ticket number or subject" onChange={(event) => update('search', event.target.value)} /></label><select value={filters.status} onChange={(event) => update('status', event.target.value)}><option value="">All statuses</option><option value="open">Open</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><select value={filters.priority} onChange={(event) => update('priority', event.target.value)}><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
      {status === 'loading' ? <LoadingRows /> : error ? <StateMessage title="Could not load tickets" copy={error} /> : tickets.items.length ? <div className="ticket-table-wrap"><table className="admin-table"><thead><tr><th className="column-heading column-heading--ticket">Ticket</th><th className="column-heading column-heading--person">Customer</th><th className="column-heading column-heading--status">Status</th><th className="column-heading column-heading--priority">Priority</th><th className="column-heading column-heading--person">Agent</th><th className="column-heading column-heading--updated">Updated</th></tr></thead><tbody>{tickets.items.map((ticket) => <tr key={ticket._id} onClick={() => navigate(`/admin/tickets/${ticket._id}`)}><td><strong>{ticket.subject}</strong><small>{ticket.ticketNumber}</small></td><td>{formatPersonName(ticket.requesterId?.name, ticket.requesterEmail)}</td><td><StatusBadge status={ticket.status} /></td><td><span className={`priority ${ticket.priority}`}>{ticket.priority}</span></td><td>{formatPersonName(ticket.assignedTo?.name, 'Unassigned')}</td><td>{formatDate(ticket.updatedAt)}</td></tr>)}</tbody></table></div> : <StateMessage title="No matching tickets" copy="Change the filters and try again." />}
      <div className="pagination"><span>Page {tickets.page} of {Math.max(1, tickets.pages)}</span><div><button disabled={tickets.page <= 1} onClick={() => update('page', tickets.page - 1)}><ChevronLeft size={16} /></button><button disabled={tickets.page >= tickets.pages} onClick={() => update('page', tickets.page + 1)}><ChevronRight size={16} /></button></div></div>
    </section>
  </main>
}

export default AdminTicketsPage
