import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import { fetchAdminCategories } from '../../features/admin/adminSlice.js'
import { adminService } from '../../services/admin.service.js'
import { LoadingRows, StateMessage } from '../../components/dashboard/TicketUi.jsx'

function AdminSettingsPage() {
  const dispatch = useDispatch()
  const { categories, status, error } = useSelector((state) => state.admin)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionError, setActionError] = useState('')

  function reload() {
    dispatch(fetchAdminCategories())
  }
  useEffect(reload, [dispatch])

  async function toggle(item) {
    try {
      await adminService.updateCategory(item._id, { isActive: !item.isActive })
      setActionError('')
      reload()
    } catch (cause) { setActionError(cause.message) }
  }

  async function remove(item) {
    if (!window.confirm(`Delete or deactivate ${item.name}?`)) return
    try {
      await adminService.deleteCategory(item._id)
      setActionError('')
      reload()
    } catch (cause) { setActionError(cause.message) }
  }

  return <main className="dashboard-content"><section className="page-title"><div><span>Support configuration</span><h1>Categories</h1><p>Configure ticket classification for incoming requests.</p></div></section>
    {(error || actionError) && <div className="form-alert">{actionError || error}</div>}
    {status === 'loading' && !categories.items.length ? <LoadingRows /> : <SettingsPanel title="Ticket categories" copy="Organize incoming requests." onAdd={() => setModalOpen(true)}>{categories.items.length ? categories.items.map((item) => <SettingsRow key={item._id} item={item} detail={item.description || 'No description'} onToggle={() => toggle(item)} onDelete={() => remove(item)} />) : <StateMessage title="No categories" copy="Create the first category." />}</SettingsPanel>}
    {modalOpen && <CategoryModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); reload() }} />}
  </main>
}

function SettingsPanel({ title, copy, onAdd, children }) {
  return <section className="content-panel"><div className="panel-title"><div><h2>{title}</h2><p>{copy}</p></div><button onClick={onAdd}><Plus size={14} />Add</button></div><div className="settings-list">{children}</div></section>
}

function SettingsRow({ item, detail, onToggle, onDelete }) {
  return <div className="settings-row"><div><strong>{item.name}</strong><small>{detail}</small></div><span className={`account-status ${item.isActive ? '' : 'blocked'}`}>{item.isActive ? 'Active' : 'Inactive'}</span><div><button className="small-button muted" onClick={onToggle}>{item.isActive ? 'Disable' : 'Enable'}</button><button className="small-button danger" onClick={onDelete}>Delete</button></div></div>
}

function CategoryModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await adminService.createCategory(form)
      onCreated()
    } catch (cause) { setError(cause.message) }
    finally { setLoading(false) }
  }

  return <div className="modal-backdrop"><form className="simple-modal" onSubmit={submit}><h2>Create category</h2><label>Name<input required maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Description<textarea maxLength="2000" rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>{error && <div className="form-alert">{error}</div>}<div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button disabled={loading}>{loading ? 'Creating...' : 'Create'}</button></div></form></div>
}

export default AdminSettingsPage
