import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock3, Send, UserRound } from 'lucide-react'
import { clearAdminTicket, fetchAdminAgents, fetchAdminCategories, fetchAdminTicket } from '../../features/admin/adminSlice.js'
import { adminService } from '../../services/admin.service.js'
import { LoadingRows, StatusBadge } from '../../components/dashboard/TicketUi.jsx'
import { formatDate } from '../../utils/date.js'
import { formatPersonName } from '../../utils/name.js'
import { useAutoDismiss } from '../../hooks/useAutoDismiss.js'

const statusTransitions = {
  open: ['in_progress', 'pending', 'resolved', 'closed'],
  in_progress: ['open', 'pending', 'resolved', 'closed'],
  pending: ['open', 'in_progress', 'resolved', 'closed'],
  resolved: ['open', 'closed'],
  closed: ['open'],
}

function AdminTicketDetailPage() {
  const { ticketId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { ticket, detailStatus, agents, categories, error } = useSelector((state) => state.admin)
  const [reply, setReply] = useState('')
  const [replyType, setReplyType] = useState('public')
  const [detailsDraft, setDetailsDraft] = useState({ ticketId: '', status: '', priority: '', category: '' })
  const [selectedAgent, setSelectedAgent] = useState('')
  const [reason, setReason] = useState('')
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  useAutoDismiss(feedback, () => setFeedback(''))
  useAutoDismiss(actionError, () => setActionError(''))

  useEffect(() => {
    dispatch(fetchAdminTicket(ticketId))
    dispatch(fetchAdminAgents({ page: 1, limit: 100, blocked: false }))
    dispatch(fetchAdminCategories({ page: 1, limit: 100, active: true }))
    return () => dispatch(clearAdminTicket())
  }, [dispatch, ticketId])

  const timeline = useMemo(() => {
    if (!ticket) return []
    const original = { _id: 'original', kind: 'message', body: ticket.description, senderRole: 'user', createdAt: ticket.createdAt }
    return [original, ...(ticket.messages || []).map((item) => ({ ...item, kind: 'message' })), ...(ticket.activities || []).map((item) => ({ ...item, kind: 'activity' }))]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }, [ticket])
  const draft = detailsDraft.ticketId === ticketId
    ? detailsDraft
    : { ticketId, status: ticket?.status || '', priority: ticket?.priority || '', category: ticket?.category?._id || '' }
  const selectedStatus = draft.status
  const detailsChanged = Boolean(ticket) && (
    draft.status !== ticket.status
    || draft.priority !== ticket.priority
    || draft.category !== (ticket.category?._id || '')
  )
  const assignmentStateInvalid = ticket?.status === 'closed' && selectedStatus !== 'open'

  async function run(operation, success) {
    setBusy(true); setActionError(''); setFeedback('')
    try { await operation(); setFeedback(success); await dispatch(fetchAdminTicket(ticketId)).unwrap(); return true }
    catch (cause) { setActionError(cause.message); return false }
    finally { setBusy(false) }
  }

  function assign() {
    if (ticket.isBlocked) return setActionError('Unblock this ticket before assigning or reassigning it.')
    if (assignmentStateInvalid) return setActionError('First choose a valid status. Select Open before assigning or reassigning this closed ticket.')
    if (!selectedAgent) return setActionError('Select an agent')
    const reassignment = Boolean(ticket.assignedTo)
    if (reassignment && !reason.trim()) return setActionError('Reassignment reason is required')
    run(async () => {
      if (selectedStatus !== ticket.status) {
        await adminService.updateTicket(ticketId, 'status', { status: selectedStatus })
      }
      return adminService.updateTicket(ticketId, reassignment ? 'reassign' : 'assign', { agentId: selectedAgent, ...(reassignment && { reason: reason.trim() }) })
    }, reassignment ? 'Ticket reassigned' : 'Ticket assigned')
  }

  function updateDraft(key, value) {
    setDetailsDraft({ ...draft, [key]: value })
    setActionError('')
  }

  function saveTicketDetails() {
    if (ticket.isBlocked) return setActionError('Unblock this ticket before changing its details.')
    if (!detailsChanged) return
    run(async () => {
      if (draft.status !== ticket.status) await adminService.updateTicket(ticketId, 'status', { status: draft.status })
      if (draft.priority !== ticket.priority) await adminService.updateTicket(ticketId, 'priority', { priority: draft.priority })
      if (draft.category !== (ticket.category?._id || '')) await adminService.updateTicket(ticketId, 'category', { category: draft.category || null })
    }, 'Ticket details updated')
  }

  async function sendReply(event) {
    event.preventDefault()
    if (!reply.trim()) return
    await run(() => adminService.reply(ticketId, reply.trim(), replyType), replyType === 'internal' ? 'Internal note added' : 'Reply sent')
    setReply('')
  }

  async function blockTicket(event) {
    event.preventDefault()
    const value = blockReason.trim()
    if (!value) return
    const succeeded = await run(() => adminService.updateTicket(ticketId, 'block', { reason: value }), 'Ticket blocked')
    if (succeeded) {
      setBlockDialogOpen(false)
      setBlockReason('')
    }
  }

  if (detailStatus === 'loading' || !ticket && detailStatus === 'idle') return <main className="dashboard-content"><LoadingRows /></main>
  if (!ticket) return <main className="dashboard-content"><button className="back-link" onClick={() => navigate('/admin/tickets')}><ArrowLeft size={16} />Back</button><div className="form-alert">{error || 'Ticket not found'}</div></main>

  return <main className="dashboard-content"><button className="back-link" onClick={() => navigate('/admin/tickets')}><ArrowLeft size={16} />Back to all tickets</button>
    <section className="ticket-detail-head"><div><span>{ticket.ticketNumber}</span><h1>{ticket.subject}</h1><p>{formatPersonName(ticket.requesterId?.name, 'Customer')} · {ticket.requesterEmail}</p></div><StatusBadge status={ticket.status} /></section>
    {feedback && <div className="success-banner">{feedback}</div>}{(actionError || error) && <div className="form-alert">{actionError || error}</div>}
    <div className="admin-detail-grid"><section className="content-panel conversation"><div className="panel-title"><div><h2>Conversation & activity</h2><p>Public messages, internal notes and ticket events</p></div></div><div className="timeline">{timeline.map((item) => <AdminTimelineItem key={`${item.kind}-${item._id}`} item={item} />)}</div>
      {!ticket.isBlocked && <form className="reply-composer" onSubmit={sendReply}><div><button className={`reply-mode-button ${replyType === 'public' ? 'active' : ''}`} type="button" onClick={() => setReplyType('public')}>Public</button><button className={`reply-mode-button ${replyType === 'internal' ? 'active' : ''}`} type="button" onClick={() => setReplyType('internal')}>Note</button><span>{replyType === 'internal' ? 'Internal note' : 'Customer reply'}</span></div><textarea rows="5" maxLength="20000" value={reply} placeholder={replyType === 'internal' ? 'Write a note visible only to support staff...' : 'Write a reply to the customer...'} onChange={(event) => setReply(event.target.value)} /><footer><small>{reply.length}/20000</small><button disabled={busy || !reply.trim()}><Send size={14} />Send</button></footer></form>}
    </section><aside className="content-panel metadata"><h2>Ticket controls</h2><div className="control-stack">
      {ticket.isBlocked && <div className="assignment-lock-note">This ticket is blocked. <strong>Unblock the ticket</strong> before changing Status, Priority, or Category.</div>}
      <label>Status<select value={draft.status} disabled={busy || ticket.isBlocked} onChange={(event) => updateDraft('status', event.target.value)}><option value={ticket.status}>{ticket.status.replace('_', ' ')}</option>{statusTransitions[ticket.status].map((status) => <option value={status} key={status}>{status.replace('_', ' ')}</option>)}</select></label>
      <label>Priority<select value={draft.priority} disabled={busy || ticket.isBlocked} onChange={(event) => updateDraft('priority', event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
      <label>Category<select value={draft.category} disabled={busy || ticket.isBlocked} onChange={(event) => updateDraft('category', event.target.value)}><option value="">No category</option>{categories.items.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select></label>
      <button className="primary-button" disabled={busy || ticket.isBlocked || !detailsChanged} onClick={saveTicketDetails}>{busy ? 'Updating...' : 'Change ticket details'}</button>
      {ticket.isBlocked
        ? <div className="assignment-lock-note">This ticket is blocked{ticket.status === 'closed' ? ' and closed' : ''}. <strong>Unblock the ticket</strong>{ticket.status === 'closed' ? ' and select Open' : ''} before assigning or reassigning it.</div>
        : ticket.status === 'closed' && <div className={`assignment-lock-note ${assignmentStateInvalid ? '' : 'ready'}`}>{assignmentStateInvalid ? <>First choose a valid status. Select <strong>Open</strong>, then click {ticket.assignedTo ? 'Reassign ticket' : 'Assign ticket'}.</> : <>Open is selected. Click <strong>{ticket.assignedTo ? 'Reassign ticket' : 'Assign ticket'}</strong> to apply the status and assignment together.</>}</div>}
      <label>Assigned agent<select value={selectedAgent} disabled={busy || ticket.isBlocked} onChange={(event) => setSelectedAgent(event.target.value)}><option value="">Select agent</option>{agents.items.map((item) => <option value={item._id} key={item._id}>{formatPersonName(item.name, 'Agent')}</option>)}</select></label>
      {ticket.assignedTo && <label>Reassignment reason<input maxLength="500" disabled={busy || ticket.isBlocked} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
      <button className="primary-button" disabled={busy || ticket.isBlocked} onClick={assign}>{ticket.assignedTo ? 'Reassign ticket' : 'Assign ticket'}</button>
      {ticket.isBlocked
        ? <button className="small-button unblock-button" disabled={busy} onClick={() => run(() => adminService.updateTicket(ticketId, 'unblock'), 'Ticket unblocked')}>Unblock ticket</button>
        : <button className="small-button danger" disabled={busy} onClick={() => { setBlockReason(''); setBlockDialogOpen(true) }}>Block ticket</button>}
      <small>Created {formatDate(ticket.createdAt)}</small><small>Last updated {formatDate(ticket.updatedAt)}</small>
    </div></aside></div>
    {blockDialogOpen && <div className="modal-backdrop"><form className="simple-modal" onSubmit={blockTicket}><h2>Block ticket</h2><p className="dialog-copy">Enter a reason for blocking this ticket.</p><label>Reason<textarea required autoFocus maxLength="500" rows="4" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} placeholder="Why is this ticket being blocked?" /></label><div className="modal-actions"><button type="button" onClick={() => { setBlockDialogOpen(false); setBlockReason('') }}>Cancel</button><button disabled={busy || !blockReason.trim()}>{busy ? 'Blocking...' : 'Block ticket'}</button></div></form></div>}
  </main>
}

function AdminTimelineItem({ item }) {
  if (item.kind === 'activity') return <div className="activity-line"><span><Clock3 size={13} /></span><p><strong>{item.action.replaceAll('_', ' ')}</strong><small>{formatDate(item.createdAt)}</small></p></div>
  const internal = item.type === 'internal'
  return <div className={`message-item ${item.senderRole === 'user' ? 'customer' : ''}`}><span><UserRound size={15} /></span><div><header><strong>{formatPersonName(item.senderId?.name, item.senderRole === 'user' ? 'Customer' : 'Support Team')}{internal ? ' · Internal note' : ''}</strong><small>{formatDate(item.createdAt)}</small></header><p>{item.body}</p></div></div>
}

export default AdminTicketDetailPage
