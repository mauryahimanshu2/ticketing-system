import axios from 'axios'
import { API_BASE_URL, API_TIMEOUT } from '../config/api.js'
import { getAccessToken } from './token.service.js'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error
      || error.message
      || 'Something went wrong. Please try again.'
    return Promise.reject(new Error(message))
  },
)

export function apiRequest(path, options = {}) {
  return apiClient.request({
    url: path,
    ...options,
  })
}
