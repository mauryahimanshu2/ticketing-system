import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Eye, EyeOff, Plus, Search, UserRound } from 'lucide-react'
import { fetchAdminAgents, fetchAdminUsers } from '../../features/admin/adminSlice.js'
import { adminService } from '../../services/admin.service.js'
import { LoadingRows, StateMessage } from '../../components/dashboard/TicketUi.jsx'
import { formatDate } from '../../utils/date.js'
import { formatPersonName } from '../../utils/name.js'

function AdminPeoplePage({ kind }) {
  const dispatch = useDispatch()
  const data = useSelector((state) => state.admin[kind === 'agent' ? 'agents' : 'users'])
  const { status, error } = useSelector((state) => state.admin)
  const [search, setSearch] = useState('')
  const [blocked, setBlocked] = useState('')
  const [target, setTarget] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const load = kind === 'agent' ? fetchAdminAgents : fetchAdminUsers

  useEffect(() => {
    const timer = setTimeout(() => dispatch(load({ page: 1, limit: 20, ...(search.trim() && { search: search.trim() }), ...(blocked && { blocked }) })), 250)
    return () => clearTimeout(timer)
  }, [dispatch, load, search, blocked])

  async function changeBlocked(reason = '') {
    try {
      await adminService.setAccountBlocked(kind, target._id, !target.isBlocked, reason)
      setTarget(null)
      setActionError('')
      dispatch(load({ page: 1, limit: 20 }))
    } catch (cause) { setActionError(cause.message) }
  }

  return <main className="dashboard-content"><section className="page-title"><div><span>Access management</span><h1>{kind === 'agent' ? 'Support agents' : 'Customers'}</h1><p>Manage account access and workload visibility.</p></div>{kind === 'agent' && <button onClick={() => setCreateOpen(true)}><Plus size={16} />Add agent</button>}</section>
    {(error || actionError) && <div className="form-alert">{actionError || error}</div>}
    <section className="content-panel"><div className="admin-toolbar"><label><Search size={15} /><input value={search} placeholder="Search name or email" onChange={(event) => setSearch(event.target.value)} /></label><select value={blocked} onChange={(event) => setBlocked(event.target.value)}><option value="">All accounts</option><option value="false">Active</option><option value="true">Blocked</option></select></div>
      {status === 'loading' ? <LoadingRows /> : !data.items.length ? <StateMessage title={`No ${kind === 'agent' ? 'agents' : 'customers'} found`} copy="Change the filters and try again." /> : <div className="ticket-table-wrap"><table className="admin-table"><thead><tr><th className="column-heading column-heading--person">Account</th><th className="column-heading column-heading--phone">Phone</th><th className="column-heading column-heading--count">Tickets</th><th className="column-heading column-heading--status">Status</th><th className="column-heading column-heading--updated">Joined</th><th className="column-heading column-heading--action">Action</th></tr></thead><tbody>{data.items.map((person) => <tr key={person._id}><td><strong>{formatPersonName(person.name, 'User')}</strong><small>{person.email}</small></td><td>{person.phone || '—'}</td><td>{person.ticketStats?.open || 0} open / {person.ticketStats?.total || 0} total</td><td><span className={`account-status ${person.isBlocked ? 'blocked' : ''}`}>{person.isBlocked ? 'Blocked' : 'Active'}</span></td><td>{formatDate(person.createdAt)}</td><td><button className={`small-button ${person.isBlocked ? 'muted' : 'danger'}`} onClick={() => { setTarget(person); setActionError('') }}>{person.isBlocked ? 'Unblock' : 'Block'}</button></td></tr>)}</tbody></table></div>}
    </section>
    {target && <BlockDialog person={target} onClose={() => setTarget(null)} onConfirm={changeBlocked} />}
    {createOpen && <AgentModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); dispatch(fetchAdminAgents({ page: 1, limit: 20 })) }} />}
  </main>
}

function BlockDialog({ person, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  return <div className="modal-backdrop"><form className="simple-modal" onSubmit={(event) => { event.preventDefault(); onConfirm(reason.trim()) }}><UserRound size={25} /><h2>{person.isBlocked ? 'Unblock account?' : 'Block account?'}</h2>{!person.isBlocked && <label>Reason<textarea required maxLength="500" rows="3" value={reason} onChange={(event) => setReason(event.target.value)} /></label>}<div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button>{person.isBlocked ? 'Unblock' : 'Block'}</button></div></form></div>
}

function AgentModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('')
    try { await adminService.createAgent(form); onCreated() } catch (cause) { setError(cause.message) } finally { setLoading(false) }
  }
  return <div className="modal-backdrop"><form className="simple-modal" onSubmit={submit}><h2>Add support agent</h2><label>Name<input required maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone (E.164)<input required placeholder="+919876543210" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Temporary password<div className="password-field"><input required type={showPassword ? 'text' : 'password'} minLength="8" maxLength="72" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>{error && <div className="form-alert">{error}</div>}<div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button disabled={loading}>{loading ? 'Creating...' : 'Create agent'}</button></div></form></div>
}

export default AdminPeoplePage
