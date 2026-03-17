import apiClient from './client'

export const airportsApi = {
  list: (params = {}) => apiClient.get('/api/airports', { params }),
  get: (code) => apiClient.get(`/api/airports/${code}`),
  create: (data) => apiClient.post('/api/airports', data),
  update: (code, data) => apiClient.put(`/api/airports/${code}`, data),
  delete: (code) => apiClient.delete(`/api/airports/${code}`),
}

