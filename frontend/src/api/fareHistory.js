import apiClient from './client'

export const fareHistoryApi = {
  list: (params = {}) => apiClient.get('/api/fare_history', { params }),
  get: (flightId, year, quarter) => apiClient.get(`/api/fare_history/${encodeURIComponent(flightId)}/${year}/${quarter}`),
  create: (data) => apiClient.post('/api/fare_history', data),
  update: (flightId, year, quarter, data) => apiClient.put(`/api/fare_history/${encodeURIComponent(flightId)}/${year}/${quarter}`, data),
  delete: (flightId, year, quarter) => apiClient.delete(`/api/fare_history/${encodeURIComponent(flightId)}/${year}/${quarter}`),
}
