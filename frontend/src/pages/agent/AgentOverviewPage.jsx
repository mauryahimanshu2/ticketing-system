import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock3, RotateCcw, Ticket, TimerReset } from 'lucide-react'
import { fetchTicketSummary, fetchTickets } from '../../features/tickets/ticketsSlice.js'
import { LoadingRows, StateMessage, TicketTable } from '../../components/dashboard/TicketUi.jsx'
import { formatPersonName } from '../../utils/name.js'

const cards = [
  ['open', 'Open', AlertCircle, ''], ['pending', 'Pending', Clock3, 'amber'],
  ['in_progress', 'In progress', TimerReset, 'violet'], ['resolved', 'Resolved', CheckCircle2, 'green'],
  ['closed', 'Closed', Ticket, 'slate'], ['reopened', 'Reopened', RotateCcw, 'rose'],
]

function AgentOverviewPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const { summary, items, listStatus, error } = useSelector((state) => state.tickets)

  useEffect(() => {
    const refresh = () => {
      dispatch(fetchTicketSummary())
      dispatch(fetchTickets({ page: 1, limit: 8, silent: true }))
    }
    dispatch(fetchTicketSummary())
    dispatch(fetchTickets({ page: 1, limit: 8 }))
    const timer = window.setInterval(() => { if (!document.hidden) refresh() }, 10000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [dispatch])

  return <main className="dashboard-content"><section className="page-title"><div><span>Assigned workload</span><h1>Welcome, {formatPersonName(user?.name, 'Agent').split(' ')[0]}</h1><p>Prioritize customer requests assigned to your queue.</p></div></section>
    <section className="count-grid">{cards.map(([key, label, Icon, tone]) => <article className={`count-card ${tone}`} key={key}><span><Icon size={18} /></span><div><strong>{summary[key] || 0}</strong><p>{label}</p></div></article>)}</section>
    <div className="agent-work-grid"><section className="content-panel"><div className="panel-title"><div><h2>Active queue</h2><p>Recently updated assigned tickets</p></div><button onClick={() => navigate('/agent/tickets')}>View all</button></div>{listStatus === 'loading' ? <LoadingRows /> : error ? <StateMessage title="Could not load queue" copy={error} /> : items.length ? <TicketTable items={items} onOpen={(id) => navigate(`/agent/tickets/${id}`)} /> : <StateMessage title="Queue is clear" copy="New assignments will appear here." />}</section>
      <aside className="content-panel queue-guide"><h2>Working the queue</h2><ul><li><span>1</span>Move an open ticket to in progress when investigation begins.</li><li><span>2</span>Use a public reply for the customer and an internal note for support context.</li><li><span>3</span>Set pending only when waiting for customer information.</li><li><span>4</span>Resolve completed work; closed tickets can be reopened when needed.</li></ul></aside>
    </div>
  </main>
}

export default AgentOverviewPage
