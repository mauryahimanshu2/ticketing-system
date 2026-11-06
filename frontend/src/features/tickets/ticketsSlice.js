import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { ticketService } from '../../services/ticket.service.js'

export const fetchTicketSummary = createAsyncThunk('tickets/summary', () => ticketService.summary())
export const fetchTickets = createAsyncThunk('tickets/list', (params = {}) => {
  const { silent: _silent, ...query } = params
  return ticketService.list(query)
})
export const fetchTicket = createAsyncThunk('tickets/detail', (request) => ticketService.get(typeof request === 'string' ? request : request.ticketId))
export const createTicket = createAsyncThunk('tickets/create', (data) => ticketService.create(data))
export const replyToTicket = createAsyncThunk('tickets/reply', ({ ticketId, body }) => ticketService.reply(ticketId, body))
export const changeTicketStatus = createAsyncThunk('tickets/status', ({ ticketId, status }) => ticketService.changeStatus(ticketId, status))

const initialState = {
  summary: { open: 0, pending: 0, in_progress: 0, resolved: 0, closed: 0, reopened: 0, total: 0 },
  items: [],
  detail: null,
  pagination: { page: 1, limit: 10, total: 0, pages: 0 },
  listStatus: 'idle',
  detailStatus: 'idle',
  mutationStatus: 'idle',
  error: null,
}

const ticketsSlice = createSlice({
  name: 'tickets',
  initialState,
  reducers: {
    clearTicketError(state) { state.error = null; state.mutationStatus = 'idle' },
    clearTicketDetail(state) { state.detail = null; state.detailStatus = 'idle' },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTicketSummary.fulfilled, (state, action) => { state.summary = action.payload })
      .addCase(fetchTickets.pending, (state, action) => { if (!action.meta.arg?.silent) state.listStatus = 'loading'; state.error = null })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.listStatus = 'succeeded'
        state.items = action.payload.items
        state.pagination = { page: action.payload.page, limit: action.payload.limit, total: action.payload.total, pages: action.payload.pages }
      })
      .addCase(fetchTicket.pending, (state, action) => { if (!(typeof action.meta.arg === 'object' && action.meta.arg?.silent)) state.detailStatus = 'loading'; state.error = null })
      .addCase(fetchTicket.fulfilled, (state, action) => { state.detailStatus = 'succeeded'; state.detail = action.payload })
      .addCase(fetchTicket.rejected, (state) => { state.detailStatus = 'failed'; state.detail = null })
      .addMatcher(
        (action) => ['tickets/create', 'tickets/reply', 'tickets/status'].some((type) => action.type === `${type}/pending`),
        (state) => { state.mutationStatus = 'loading'; state.error = null },
      )
      .addMatcher(
        (action) => ['tickets/create', 'tickets/reply', 'tickets/status'].some((type) => action.type === `${type}/fulfilled`),
        (state) => { state.mutationStatus = 'succeeded' },
      )
      .addMatcher(
        (action) => action.type.startsWith('tickets/') && action.type.endsWith('/rejected'),
        (state, action) => {
          state.listStatus = state.listStatus === 'loading' ? 'failed' : state.listStatus
          state.detailStatus = state.detailStatus === 'loading' ? 'failed' : state.detailStatus
          state.mutationStatus = state.mutationStatus === 'loading' ? 'failed' : state.mutationStatus
          state.error = action.error.message || 'Ticket request failed'
        },
      )
  },
})

export const { clearTicketError, clearTicketDetail } = ticketsSlice.actions
export default ticketsSlice.reducer
