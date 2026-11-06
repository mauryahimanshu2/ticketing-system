import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { fetchTickets } from '../../features/tickets/ticketsSlice.js'
import { LoadingRows, StateMessage, TicketTable } from '../../components/dashboard/TicketUi.jsx'

function AgentTicketsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { items, pagination, listStatus, error } = useSelector((state) => state.tickets)
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', sort: 'newest', page: 1 })

  useEffect(() => {
    const query = { page: filters.page, limit: 20, ...(filters.status && { status: filters.status }), ...(filters.priority && { priority: filters.priority }) }
    const refresh = () => dispatch(fetchTickets({ ...query, silent: true }))
    dispatch(fetchTickets(query))
    const timer = window.setInterval(() => { if (!document.hidden) refresh() }, 10000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [dispatch, filters.page, filters.status, filters.priority])

  const visible = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    const filtered = query ? items.filter((item) => `${item.subject} ${item.ticketNumber} ${item.requesterId?.name || ''}`.toLowerCase().includes(query)) : [...items]
    return filtered.sort((a, b) => filters.sort === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.updatedAt) - new Date(a.updatedAt))
  }, [items, filters.search, filters.sort])

  function update(name, value) { setFilters((current) => ({ ...current, [name]: value, ...(name !== 'page' ? { page: 1 } : {}) })) }

  return <main className="dashboard-content"><section className="page-title"><div><span>Personal work queue</span><h1>Assigned tickets</h1><p>Filter, prioritize and resolve your assigned requests.</p></div></section><section className="content-panel"><div className="filter-bar"><label><Search size={15} /><input value={filters.search} placeholder="Search current page" onChange={(event) => update('search', event.target.value)} /></label><select value={filters.status} onChange={(event) => update('status', event.target.value)}><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><select value={filters.priority} onChange={(event) => update('priority', event.target.value)}><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select><select value={filters.sort} onChange={(event) => update('sort', event.target.value)}><option value="newest">Recently updated</option><option value="oldest">Oldest created</option></select></div>{listStatus === 'loading' ? <LoadingRows /> : error ? <StateMessage title="Could not load tickets" copy={error} /> : visible.length ? <TicketTable items={visible} onOpen={(id) => navigate(`/agent/tickets/${id}`)} /> : <StateMessage title="No matching tickets" copy="Change your filters or wait for a new assignment." />}<div className="pagination"><span>Page {pagination.page} of {Math.max(1, pagination.pages)}</span><div><button disabled={pagination.page <= 1} onClick={() => update('page', pagination.page - 1)}><ChevronLeft size={16} /></button><button disabled={pagination.page >= pagination.pages} onClick={() => update('page', pagination.page + 1)}><ChevronRight size={16} /></button></div></div></section></main>
}

export default AgentTicketsPage
