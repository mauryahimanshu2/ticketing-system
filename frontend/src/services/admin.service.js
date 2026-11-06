import { apiRequest } from './api.js'

export const adminService = {
  async overview() {
    const [summary, users, agents, recentTickets] = await Promise.all([
      apiRequest('/tickets/summary'),
      apiRequest('/admin/users', { params: { page: 1, limit: 1 } }),
      apiRequest('/agents', { params: { page: 1, limit: 1 } }),
      apiRequest('/admin/tickets', { params: { page: 1, limit: 5 } }),
    ])
    return { summary, users: users.total, agents: agents.total, recentTickets: recentTickets.items }
  },
  tickets: (params) => apiRequest('/admin/tickets', { params }),
  ticket: (id) => apiRequest(`/admin/tickets/${id}`),
  users: (params) => apiRequest('/admin/users', { params }),
  agents: (params) => apiRequest('/agents', { params }),
  categories: (params) => apiRequest('/admin/categories', { params }),
  auditLogs: (params) => apiRequest('/admin/audit-logs', { params }),
  createAgent: (data) => apiRequest('/agents', { method: 'POST', data }),
  updateTicket(id, action, data = {}) {
    return apiRequest(`/admin/tickets/${id}/${action}`, { method: 'PATCH', data })
  },
  reply(id, body, type) {
    return apiRequest(`/tickets/${id}/messages`, { method: 'POST', data: { body, type } })
  },
  setAccountBlocked(kind, id, blocked, reason) {
    const root = kind === 'agent' ? '/agents' : '/admin/users'
    return apiRequest(`${root}/${id}/${blocked ? 'block' : 'unblock'}`, {
      method: 'PATCH',
      data: blocked ? { reason } : {},
    })
  },
  createCategory: (data) => apiRequest('/admin/categories', { method: 'POST', data }),
  updateCategory: (id, data) => apiRequest(`/admin/categories/${id}`, { method: 'PATCH', data }),
  deleteCategory: (id) => apiRequest(`/admin/categories/${id}`, { method: 'DELETE' }),
}
