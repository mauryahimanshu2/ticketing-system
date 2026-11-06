import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { fetchTickets } from '../features/tickets/ticketsSlice.js'
import { LoadingRows, StateMessage, TicketTable } from '../components/dashboard/TicketUi.jsx'

function TicketsPage() {
  const dispatch = useDispatch(); const navigate = useNavigate(); const { openCreate } = useOutletContext()
  const { items, pagination, listStatus, error } = useSelector((state) => state.tickets)
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', sort: 'newest', page: 1 })
  useEffect(() => { dispatch(fetchTickets({ page: filters.page, limit: 10, ...(filters.status && { status: filters.status }), ...(filters.priority && { priority: filters.priority }) })) }, [dispatch, filters.page, filters.status, filters.priority])
  const visible = useMemo(() => {
    const query = filters.search.toLowerCase().trim(); let result = query ? items.filter((item) => `${item.subject} ${item.ticketNumber}`.toLowerCase().includes(query)) : [...items]
    return result.sort((a,b) => filters.sort === 'oldest' ? new Date(a.createdAt)-new Date(b.createdAt) : new Date(b.createdAt)-new Date(a.createdAt))
  }, [items, filters.search, filters.sort])
  function update(name,value) { setFilters((current) => ({ ...current, [name]: value, ...(name !== 'page' ? { page: 1 } : {}) })) }
  return <main className="dashboard-content"><section className="page-title"><div><span>My support requests</span><h1>Tickets</h1><p>Search, filter and follow every request.</p></div><button onClick={openCreate}><Plus size={17} />Create ticket</button></section>
    <section className="content-panel"><div className="filter-bar"><label><Search size={16} /><input placeholder="Search current page…" value={filters.search} onChange={(e)=>update('search',e.target.value)} /></label><select value={filters.status} onChange={(e)=>update('status',e.target.value)}><option value="">All statuses</option><option value="open">Open</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><select value={filters.priority} onChange={(e)=>update('priority',e.target.value)}><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select><select value={filters.sort} onChange={(e)=>update('sort',e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option></select></div>
      {listStatus==='loading'?<LoadingRows/>:error?<StateMessage title="Could not load tickets" copy={error}/>:visible.length===0?<StateMessage title="No matching tickets" copy="Change filters or create a new request."/>:<TicketTable items={visible} onOpen={(id)=>navigate(`/app/tickets/${id}`)}/>}<div className="pagination"><span>Page {pagination.page} of {Math.max(1,pagination.pages)}</span><div><button disabled={pagination.page<=1} onClick={()=>update('page',pagination.page-1)}><ChevronLeft size={16}/></button><button disabled={pagination.page>=pagination.pages} onClick={()=>update('page',pagination.page+1)}><ChevronRight size={16}/></button></div></div>
    </section></main>
}
export default TicketsPage
