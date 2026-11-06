import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Search } from 'lucide-react'
import { fetchAuditLogs } from '../../features/admin/adminSlice.js'
import { LoadingRows, StateMessage } from '../../components/dashboard/TicketUi.jsx'
import { formatDate } from '../../utils/date.js'
import { formatPersonName } from '../../utils/name.js'

function AdminAuditPage() {
  const dispatch = useDispatch()
  const { audit, status, error } = useSelector((state) => state.admin)
  const [action, setAction] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => dispatch(fetchAuditLogs({ page: 1, limit: 20, ...(action.trim() && { action: action.trim() }) })), 250)
    return () => clearTimeout(timer)
  }, [dispatch, action])

  return <main className="dashboard-content"><section className="page-title"><div><span>Security trail</span><h1>Audit logs</h1><p>Review administrative changes recorded by the backend.</p></div></section><section className="content-panel"><div className="admin-toolbar"><label><Search size={15} /><input value={action} placeholder="Filter exact action" onChange={(event) => setAction(event.target.value)} /></label></div>{status === 'loading' ? <LoadingRows /> : error ? <StateMessage title="Could not load audit logs" copy={error} /> : audit.items.length ? <div className="ticket-table-wrap"><table className="admin-table"><thead><tr><th className="column-heading column-heading--action">Action</th><th className="column-heading column-heading--person">Administrator</th><th className="column-heading column-heading--target">Target</th><th className="column-heading column-heading--details">Details</th><th className="column-heading column-heading--updated">Date</th></tr></thead><tbody>{audit.items.map((log) => <tr key={log._id}><td className="audit-action">{log.action.replaceAll('_', ' ')}</td><td><strong>{formatPersonName(log.actorId?.name, 'Administrator')}</strong><small>{log.actorId?.email}</small></td><td>{log.targetType}</td><td className="audit-details">{JSON.stringify(log.details || {})}</td><td>{formatDate(log.createdAt)}</td></tr>)}</tbody></table></div> : <StateMessage title="No audit entries" copy="Administrative changes will appear here." />}</section></main>
}

export default AdminAuditPage
