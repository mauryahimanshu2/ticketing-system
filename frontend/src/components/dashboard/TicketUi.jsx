import { ArrowRight, Ticket } from 'lucide-react'
import { formatDate } from '../../utils/date.js'

export function TicketTable({ items, onOpen }) {
  return <div className="ticket-table-wrap"><table className="ticket-table"><thead><tr><th className="column-heading column-heading--ticket">Ticket</th><th className="column-heading column-heading--status">Status</th><th className="column-heading column-heading--priority">Priority</th><th className="column-heading column-heading--updated">Updated</th><th /></tr></thead><tbody>{items.map((ticket) => <tr key={ticket._id} onClick={() => onOpen(ticket._id)}><td><strong>{ticket.subject}</strong><small>{ticket.ticketNumber}</small></td><td><StatusBadge status={ticket.status} /></td><td><span className={`priority ${ticket.priority}`}>{ticket.priority}</span></td><td>{formatDate(ticket.updatedAt)}</td><td><ArrowRight size={15} /></td></tr>)}</tbody></table></div>
}

export function StatusBadge({ status = '' }) {
  return <span className={`status ${status}`}><i />{status.replace('_', ' ')}</span>
}

export function StateMessage({ title, copy }) {
  return <div className="empty-panel"><Ticket size={25} /><strong>{title}</strong><p>{copy}</p></div>
}

export function LoadingRows() {
  return <div className="loading-rows">{[1, 2, 3, 4].map((row) => <span key={row} />)}</div>
}
