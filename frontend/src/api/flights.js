import apiClient from './client'

export const flightsApi = {
  list: (params = {}) => apiClient.get('/api/flights', { params }),
  get: (id) => apiClient.get(`/api/flights/${id}`),
  create: (data) => apiClient.post('/api/flights', data),
  update: (id, data) => apiClient.put(`/api/flights/${id}`, data),
  delete: (id) => apiClient.delete(`/api/flights/${id}`),
}

