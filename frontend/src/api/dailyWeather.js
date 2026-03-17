import apiClient from './client'

export const dailyWeatherApi = {
  list: (params = {}) => apiClient.get('/api/daily_weather', { params }),
  get: (stationId, date) => apiClient.get(`/api/daily_weather/${stationId}/${date}`),
  create: (data) => apiClient.post('/api/daily_weather', data),
  update: (stationId, date, data) => apiClient.put(`/api/daily_weather/${stationId}/${date}`, data),
  delete: (stationId, date) => apiClient.delete(`/api/daily_weather/${stationId}/${date}`),
}

