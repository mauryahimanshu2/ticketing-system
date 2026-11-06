import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock3, Send, UserRound } from 'lucide-react'
import { clearTicketDetail, fetchTicket, fetchTicketSummary } from '../../features/tickets/ticketsSlice.js'
import { ticketService } from '../../services/ticket.service.js'
import { LoadingRows, StatusBadge } from '../../components/dashboard/TicketUi.jsx'
import { formatDate } from '../../utils/date.js'
import { formatPersonName } from '../../utils/name.js'
import { useAutoDismiss } from '../../hooks/useAutoDismiss.js'

const transitions = {
  open: ['in_progress', 'pending', 'resolved', 'closed'],
  in_progress: ['open', 'pending', 'resolved', 'closed'],
  pending: ['open', 'in_progress', 'resolved', 'closed'],
  resolved: ['open', 'closed'],
  closed: ['open'],
}

function AgentTicketDetailPage() {
  const { ticketId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { detail: ticket, detailStatus, error } = useSelector((state) => state.tickets)
  const [mode, setMode] = useState('public')
  const [message, setMessage] = useState('')
  const [detailsDraft, setDetailsDraft] = useState({ ticketId: '', status: '', priority: '' })
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [actionError, setActionError] = useState('')
  useAutoDismiss(feedback, () => setFeedback(''))
  useAutoDismiss(actionError, () => setActionError(''))

  useEffect(() => {
    dispatch(fetchTicket(ticketId))
    const refresh = () => dispatch(fetchTicket({ ticketId, silent: true }))
    const timer = window.setInterval(() => { if (!document.hidden) refresh() }, 10000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      dispatch(clearTicketDetail())
    }
  }, [dispatch, ticketId])

  const timeline = useMemo(() => {
    if (!ticket) return []
    const original = { _id: 'original', kind: 'message', body: ticket.description, senderRole: 'user', createdAt: ticket.createdAt }
    const messages = (ticket.messages || []).map((item) => ({ ...item, kind: 'message' }))
    const activities = (ticket.activities || []).filter((item) => !['customer_reply', 'agent_reply'].includes(item.action)).map((item) => ({ ...item, kind: 'activity' }))
    return [original, ...messages, ...activities].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }, [ticket])

  async function run(operation, success) {
    setBusy(true); setActionError(''); setFeedback('')
    try {
      await operation()
      setFeedback(success)
      await dispatch(fetchTicket(ticketId)).unwrap()
      dispatch(fetchTicketSummary())
      return true
    } catch (cause) { setActionError(cause.message); return false }
    finally { setBusy(false) }
  }

  async function submitMessage(event) {
    event.preventDefault()
    if (!message.trim()) return
    const body = message.trim()
    const succeeded = await run(() => ticketService.reply(ticketId, body, mode), mode === 'internal' ? 'Internal note added' : 'Reply sent to the customer')
    if (succeeded) setMessage('')
  }

  if (detailStatus === 'loading' || !ticket && detailStatus === 'idle') return <main className="dashboard-content"><LoadingRows /></main>
  if (!ticket) return <main className="dashboard-content"><button className="back-link" onClick={() => navigate('/agent/tickets')}><ArrowLeft size={16} />Back</button><div className="form-alert">{error || 'Ticket not found or not assigned to you'}</div></main>

  const draft = detailsDraft.ticketId === ticketId
    ? detailsDraft
    : { ticketId, status: ticket.status, priority: ticket.priority }
  const detailsChanged = draft.status !== ticket.status || draft.priority !== ticket.priority

  function updateDraft(key, value) {
    setDetailsDraft({ ...draft, [key]: value })
    setActionError('')
  }

  function saveTicketDetails() {
    if (!detailsChanged) return
    if (draft.status !== ticket.status && ['resolved', 'closed'].includes(draft.status) && !window.confirm(`Change this ticket to ${draft.status}?`)) return
    run(async () => {
      if (draft.status !== ticket.status) await ticketService.changeStatus(ticketId, draft.status)
      if (draft.priority !== ticket.priority) await ticketService.changePriority(ticketId, draft.priority)
    }, 'Ticket details updated')
  }

  return <main className="dashboard-content"><button className="back-link" onClick={() => navigate('/agent/tickets')}><ArrowLeft size={16} />Back to assigned tickets</button><section className="agent-ticket-head ticket-detail-head"><div><span>{ticket.ticketNumber}</span><h1>{ticket.subject}</h1><p>{formatPersonName(ticket.requesterId?.name, 'Customer')} · {ticket.requesterEmail}</p></div><div><StatusBadge status={ticket.status} /><span className={`priority ${ticket.priority}`}>{ticket.priority}</span></div></section>
    {feedback && <div className="success-banner">{feedback}</div>}{(actionError || error) && <div className="form-alert">{actionError || error}</div>}
    <div className="agent-work-grid"><section className="content-panel conversation"><div className="panel-title"><div><h2>Conversation & timeline</h2><p>Customer replies, support notes and ticket events</p></div></div><div className="timeline">{timeline.map((item) => <AgentTimelineItem key={`${item.kind}-${item._id}`} item={item} />)}</div>
      {!ticket.isBlocked && <form className="reply-composer" onSubmit={submitMessage}><div><button type="button" className={`reply-mode-button ${mode === 'public' ? 'active' : ''}`} onClick={() => setMode('public')}>Reply</button><button type="button" className={`reply-mode-button ${mode === 'internal' ? 'active' : ''}`} onClick={() => setMode('internal')}>Note</button><span>{mode === 'public' ? 'Customer reply' : 'Internal only'}</span></div><textarea rows="5" maxLength="20000" value={message} placeholder={mode === 'internal' ? 'Add context for support staff...' : 'Write a reply to the customer...'} onChange={(event) => setMessage(event.target.value)} /><footer><small>{message.length}/20000</small><button disabled={busy || !message.trim()}><Send size={14} />Send</button></footer></form>}
    </section><aside className="content-panel agent-control-panel"><h2>Ticket controls</h2><label>Status<select value={draft.status} disabled={busy || ticket.isBlocked} onChange={(event) => updateDraft('status', event.target.value)}><option value={ticket.status}>{ticket.status.replace('_', ' ')}</option>{transitions[ticket.status].map((status) => <option value={status} key={status}>{status.replace('_', ' ')}</option>)}</select></label><label>Priority<select value={draft.priority} disabled={busy || ticket.isBlocked} onChange={(event) => updateDraft('priority', event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><button className="agent-details-button" disabled={busy || ticket.isBlocked || !detailsChanged} onClick={saveTicketDetails}>{busy ? 'Updating...' : 'Change ticket details'}</button><dl><div><dt>Customer</dt><dd>{formatPersonName(ticket.requesterId?.name, '—')}</dd></div><div><dt>Category</dt><dd>{ticket.category?.name || 'Not assigned'}</dd></div><div><dt>Created</dt><dd>{formatDate(ticket.createdAt)}</dd></div><div><dt>Last updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></div></dl>{ticket.isBlocked && <div className="form-alert">This ticket is blocked. Only an admin can unblock it.</div>}</aside></div>
  </main>
}

function AgentTimelineItem({ item }) {
  if (item.kind === 'activity') return <div className="activity-line"><span><Clock3 size={13} /></span><p><strong>{item.action.replaceAll('_', ' ')}</strong><small>{formatDate(item.createdAt)}</small></p></div>
  const internal = item.type === 'internal'
  return <div className={`message-item ${item.senderRole === 'user' ? 'customer' : ''}`}><span><UserRound size={15} /></span><div><header><strong>{formatPersonName(item.senderId?.name, item.senderRole === 'user' ? 'Customer' : 'Support Team')}{internal ? ' · Internal note' : ''}</strong><small>{formatDate(item.createdAt)}</small></header><p>{item.body}</p></div></div>
}

export default AgentTicketDetailPage
