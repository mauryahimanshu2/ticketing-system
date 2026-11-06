import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight, CheckCircle2, CircleDot, Clock3, Plus, RotateCcw, Ticket, TimerReset } from 'lucide-react'
import { fetchTicketSummary, fetchTickets } from '../features/tickets/ticketsSlice.js'
import { LoadingRows, StateMessage, TicketTable } from '../components/dashboard/TicketUi.jsx'
import { formatPersonName } from '../utils/name.js'

const cards = [
  ['open', 'Open', CircleDot, 'blue'], ['pending', 'Pending', Clock3, 'amber'],
  ['in_progress', 'In progress', TimerReset, 'violet'], ['resolved', 'Resolved', CheckCircle2, 'green'],
  ['closed', 'Closed', Ticket, 'slate'], ['reopened', 'Reopened', RotateCcw, 'rose'],
]

function DashboardPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { openCreate } = useOutletContext()
  const user = useSelector((state) => state.auth.user)
  const { summary, items, listStatus, error } = useSelector((state) => state.tickets)

  useEffect(() => {
    dispatch(fetchTicketSummary())
    dispatch(fetchTickets({ page: 1, limit: 5 }))
  }, [dispatch])

  return <main className="dashboard-content">
    <section className="dashboard-welcome"><div><span>Support overview</span><h1>Hello, {formatPersonName(user?.name, 'there').split(' ')[0]}!</h1><p>See your requests, recent updates and support progress in one place.</p></div><button onClick={openCreate}><Plus size={17} />Create ticket</button></section>
    <section className="count-grid">{cards.map(([key,label,Icon,tone]) => <article className={`count-card ${tone}`} key={key}><span><Icon size={18} /></span><div><strong>{summary[key] || 0}</strong><p>{label}</p></div></article>)}</section>
    <section className="content-panel recent-panel"><div className="panel-title"><div><h2>Recent tickets</h2><p>Your latest support requests</p></div><button onClick={() => navigate('/app/tickets')}>View all <ArrowRight size={15} /></button></div>
      {listStatus === 'loading' ? <LoadingRows /> : error ? <StateMessage title="Could not load tickets" copy={error} /> : items.length === 0 ? <StateMessage title="No tickets yet" copy="Create your first support request to get started." /> : <TicketTable items={items} onOpen={(id) => navigate(`/app/tickets/${id}`)} />}
    </section>
  </main>
}

export default DashboardPage
