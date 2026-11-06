import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { adminService } from '../../services/admin.service.js'

export const fetchAdminOverview = createAsyncThunk('admin/overview', () => adminService.overview())
export const fetchAdminTickets = createAsyncThunk('admin/tickets', (params) => adminService.tickets(params))
export const fetchAdminTicket = createAsyncThunk('admin/ticket', (id) => adminService.ticket(id))
export const fetchAdminUsers = createAsyncThunk('admin/users', (params) => adminService.users(params))
export const fetchAdminAgents = createAsyncThunk('admin/agents', (params) => adminService.agents(params))
export const fetchAdminCategories = createAsyncThunk('admin/categories', (params = { page: 1, limit: 100 }) => adminService.categories(params))
export const fetchAuditLogs = createAsyncThunk('admin/audit', (params) => adminService.auditLogs(params))

const emptyList = { items: [], page: 1, limit: 20, total: 0, pages: 0 }
const initialState = {
  overview: { summary: {}, users: 0, agents: 0, recentTickets: [] },
  tickets: emptyList,
  users: emptyList,
  agents: emptyList,
  categories: emptyList,
  audit: emptyList,
  ticket: null,
  status: 'idle',
  detailStatus: 'idle',
  error: null,
}

const listActions = [
  [fetchAdminTickets, 'tickets'], [fetchAdminUsers, 'users'], [fetchAdminAgents, 'agents'],
  [fetchAdminCategories, 'categories'], [fetchAuditLogs, 'audit'],
]

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError(state) { state.error = null },
    clearAdminTicket(state) { state.ticket = null; state.detailStatus = 'idle' },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminOverview.pending, (state) => { state.status = 'loading'; state.error = null })
      .addCase(fetchAdminOverview.fulfilled, (state, action) => { state.status = 'succeeded'; state.overview = action.payload })
      .addCase(fetchAdminTicket.pending, (state) => { state.detailStatus = 'loading'; state.error = null })
      .addCase(fetchAdminTicket.fulfilled, (state, action) => { state.detailStatus = 'succeeded'; state.ticket = action.payload })
    listActions.forEach(([action, key]) => {
      builder
        .addCase(action.pending, (state) => { state.status = 'loading'; state.error = null })
        .addCase(action.fulfilled, (state, result) => { state.status = 'succeeded'; state[key] = result.payload })
    })
    builder.addMatcher(
      (action) => action.type.startsWith('admin/') && action.type.endsWith('/rejected'),
      (state, action) => {
        state.status = 'failed'
        state.detailStatus = state.detailStatus === 'loading' ? 'failed' : state.detailStatus
        state.error = action.error.message || 'Admin request failed'
      },
    )
  },
})

export const { clearAdminError, clearAdminTicket } = adminSlice.actions
export default adminSlice.reducer
