import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bold, CheckCircle2, Clock3, Italic, RotateCcw, Send, UserRound } from 'lucide-react'
import { changeTicketStatus, clearTicketDetail, clearTicketError, fetchTicket, fetchTicketSummary, replyToTicket } from '../features/tickets/ticketsSlice.js'
import { LoadingRows, StatusBadge } from '../components/dashboard/TicketUi.jsx'
import { formatPersonName } from '../utils/name.js'
import { formatDate } from '../utils/date.js'
import { useAutoDismiss } from '../hooks/useAutoDismiss.js'

function TicketDetailPage() {
  const { ticketId } = useParams(); const dispatch = useDispatch(); const navigate = useNavigate()
  const { detail: ticket, detailStatus, mutationStatus, error } = useSelector((state) => state.tickets)
  const [reply, setReply] = useState(''); const [confirmStatus, setConfirmStatus] = useState(null); const [success, setSuccess] = useState('')
  useAutoDismiss(success, () => setSuccess(''))
  useAutoDismiss(error, () => dispatch(clearTicketError()))
  useEffect(() => { dispatch(fetchTicket(ticketId)); return () => dispatch(clearTicketDetail()) }, [dispatch,ticketId])
  const timeline = useMemo(() => {
    if (!ticket) return []
    const originalRequest = {
      _id: 'original-request',
      kind: 'message',
      senderRole: 'user',
      body: ticket.description,
      createdAt: ticket.createdAt,
    }
    const messages = (ticket.messages || []).map((item) => ({ ...item, kind: 'message' }))
    const activities = (ticket.activities || [])
      .filter((item) => !['customer_reply', 'agent_reply'].includes(item.action))
      .map((item) => ({ ...item, kind: 'activity' }))

    return [originalRequest, ...messages, ...activities]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  },[ticket])
  async function sendReply(event) { event.preventDefault(); if(!reply.trim()) return; try { await dispatch(replyToTicket({ticketId,body:reply.trim()})).unwrap(); setReply(''); setSuccess('Reply sent successfully'); dispatch(fetchTicket(ticketId)) } catch {} }
  async function updateStatus() { try { await dispatch(changeTicketStatus({ticketId,status:confirmStatus})).unwrap(); setSuccess(confirmStatus==='open'?'Ticket reopened successfully':'Ticket closed successfully'); setConfirmStatus(null); dispatch(fetchTicket(ticketId)); dispatch(fetchTicketSummary()) } catch {} }
  function format(prefix,suffix) { const area=document.getElementById('ticket-reply'); const start=area.selectionStart; const end=area.selectionEnd; const text=reply; setReply(`${text.slice(0,start)}${prefix}${text.slice(start,end)}${suffix}${text.slice(end)}`); setTimeout(()=>area.focus(),0) }
  if(detailStatus==='loading'||!ticket&&detailStatus==='idle') return <main className="dashboard-content"><LoadingRows/></main>
  if(detailStatus==='failed'||!ticket) return <main className="dashboard-content"><button className="back-link" onClick={()=>navigate('/app/tickets')}><ArrowLeft size={16}/>Back</button><div className="form-alert">{error||'Ticket not found'}</div></main>
  const canReopen=['closed','resolved'].includes(ticket.status); const canClose=!['closed'].includes(ticket.status)
  return <main className="dashboard-content"><button className="back-link" onClick={()=>navigate('/app/tickets')}><ArrowLeft size={16}/>Back to tickets</button>
    <section className="ticket-detail-head"><div><span>{ticket.ticketNumber}</span><h1>{ticket.subject}</h1><p>Created {formatDate(ticket.createdAt)}</p></div><div><StatusBadge status={ticket.status}/>{canReopen?<button className="outline-action" onClick={()=>setConfirmStatus('open')}><RotateCcw size={15}/>Reopen</button>:canClose&&<button className="outline-action danger" onClick={()=>setConfirmStatus('closed')}><CheckCircle2 size={15}/>Close ticket</button>}</div></section>
    {success&&<div className="success-banner">{success}</div>}{error&&<div className="form-alert">{error}</div>}
    <div className="detail-grid"><section className="content-panel conversation"><div className="panel-title"><div><h2>Conversation</h2><p>Complete chronological history</p></div></div><div className="timeline">{timeline.length===0?<p className="timeline-empty">No conversation yet.</p>:timeline.map((item)=><TimelineItem key={`${item.kind}-${item._id}`} item={item}/>)}</div>
      {!ticket.isBlocked&&ticket.status!=='closed'&&<form className="reply-composer" onSubmit={sendReply}><div><button type="button" onClick={()=>format('**','**')}><Bold size={15}/></button><button type="button" onClick={()=>format('_','_')}><Italic size={15}/></button><span>Public reply</span></div><textarea id="ticket-reply" rows="5" maxLength="20000" value={reply} placeholder="Write a reply to the support team…" onChange={(e)=>setReply(e.target.value)}/><footer><small>{reply.length}/20000</small><button disabled={mutationStatus==='loading'||!reply.trim()}><Send size={15}/>Send reply</button></footer></form>}
    </section><aside className="content-panel metadata"><h2>Ticket details</h2><dl><div><dt>Status</dt><dd><StatusBadge status={ticket.status}/></dd></div><div><dt>Priority</dt><dd className={`priority ${ticket.priority}`}>{ticket.priority}</dd></div><div><dt>Category</dt><dd>{ticket.category?.name||'Not assigned'}</dd></div><div><dt>Assigned agent</dt><dd>{formatPersonName(ticket.assignedTo?.name, 'Waiting for assignment')}</dd></div><div><dt>Last updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></div></dl></aside></div>
    {confirmStatus&&<div className="modal-backdrop"><section className="confirm-dialog"><Clock3 size={25}/><h3>{confirmStatus==='open'?'Reopen this ticket?':'Close this ticket?'}</h3><p>{confirmStatus==='open'?'The support team will be able to continue working on it.':'You can reopen it later if you need more help.'}</p><div><button onClick={()=>setConfirmStatus(null)}>Cancel</button><button onClick={updateStatus}>Confirm</button></div></section></div>}
  </main>
}

function TimelineItem({item}) { if(item.kind==='activity') return <div className="activity-line"><span><Clock3 size={13}/></span><p><strong>{item.action.replaceAll('_',' ')}</strong><small>{formatDate(item.createdAt)}</small></p></div>; return <div className={`message-item ${item.senderRole==='user'?'customer':''}`}><span><UserRound size={15}/></span><div><header><strong>{item.senderRole==='user'?'You':'Support team'}</strong><small>{formatDate(item.createdAt)}</small></header><p>{item.body}</p></div></div> }
export default TicketDetailPage
