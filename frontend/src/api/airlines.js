import apiClient from './client'

export const airlinesApi = {
  list: (params = {}) => apiClient.get('/api/airlines', { params }),
  get: (id) => apiClient.get(`/api/airlines/${id}`),
  create: (data) => apiClient.post('/api/airlines', data),
  update: (id, data) => apiClient.put(`/api/airlines/${id}`, data),
  delete: (id) => apiClient.delete(`/api/airlines/${id}`),
}

