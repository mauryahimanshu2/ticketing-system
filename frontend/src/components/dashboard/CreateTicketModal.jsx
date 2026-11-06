import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { createTicket, fetchTicketSummary, fetchTickets } from '../../features/tickets/ticketsSlice.js'
import { ticketService } from '../../services/ticket.service.js'
import './ticket-form.css'

export function CreateTicketModal({ onClose }) {
  const dispatch = useDispatch()
  const { mutationStatus, error } = useSelector((state) => state.tickets)
  const [form, setForm] = useState({ subject: '', category: '', description: '' })
  const [categories, setCategories] = useState({ items: [], loading: true, error: '' })
  const [validation, setValidation] = useState('')
  const [created, setCreated] = useState(false)

  useEffect(() => {
    let active = true
    ticketService.availableCategories()
      .then((result) => {
        if (active) setCategories({ items: result.items, loading: false, error: '' })
      })
      .catch((cause) => {
        if (active) setCategories({ items: [], loading: false, error: cause.message })
      })
    return () => { active = false }
  }, [])

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setValidation('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.subject.trim() || !form.category || !form.description.trim()) {
      setValidation('Subject, category and description are required')
      return
    }
    try {
      await dispatch(createTicket({
        subject: form.subject.trim(),
        category: form.category,
        description: form.description.trim(),
      })).unwrap()
      setCreated(true)
      dispatch(fetchTicketSummary())
      dispatch(fetchTickets({ page: 1, limit: 10 }))
    } catch { /* Redux displays the server error. */ }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><section className="ticket-modal" onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-heading"><div><span>New support request</span><h2>Create ticket</h2></div><button onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    {created ? <div className="created-state"><CheckCircle2 size={38} /><h3>Ticket created successfully</h3><p>Your request is now in the support queue.</p><button onClick={onClose}>Done</button></div> : <form onSubmit={submit}>
      <label>Subject<input value={form.subject} maxLength="500" placeholder="What do you need help with?" onChange={(event) => update('subject', event.target.value)} /></label>
      <label>Category<select required value={form.category} disabled={categories.loading} onChange={(event) => update('category', event.target.value)}><option value="">{categories.loading ? 'Loading categories...' : 'Select a category'}</option>{categories.items.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
      <label>Description<textarea rows="7" value={form.description} maxLength="20000" placeholder="Describe the issue and include steps, error messages or other useful details." onChange={(event) => update('description', event.target.value)} /></label>
      <div className="backend-note"><AlertCircle size={16} /><p>Choose the closest category so your request reaches the right support queue.</p></div>
      {(validation || categories.error || error) && <div className="form-alert">{validation || categories.error || error}</div>}
      <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button disabled={mutationStatus === 'loading' || categories.loading || !categories.items.length}>{mutationStatus === 'loading' ? 'Creating...' : 'Create ticket'}</button></div>
    </form>}
  </section></div>
}
