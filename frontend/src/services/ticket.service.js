import { apiRequest } from './api.js'

export const ticketService = {
  list(params = {}) {
    return apiRequest('/tickets', { method: 'GET', params })
  },
  summary() {
    return apiRequest('/tickets/summary')
  },
  get(ticketId) {
    return apiRequest(`/tickets/${ticketId}`)
  },
  create(data) {
    return apiRequest('/tickets', { method: 'POST', data })
  },
  availableCategories(params = { page: 1, limit: 100 }) {
    return apiRequest('/categories/available', { params })
  },
  reply(ticketId, body, type = 'public') {
    return apiRequest(`/tickets/${ticketId}/messages`, { method: 'POST', data: { body, type } })
  },
  changeStatus(ticketId, status) {
    return apiRequest(`/tickets/${ticketId}/status`, { method: 'PATCH', data: { status } })
  },
  changePriority(ticketId, priority) {
    return apiRequest(`/tickets/${ticketId}/priority`, { method: 'PATCH', data: { priority } })
  },
}
