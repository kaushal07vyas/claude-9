import apiClient from './client'

export const insightsApi = {
  priceGuidance: (origin, dest, date) => 
    apiClient.get('/api/insights/price', { params: { origin, dest, date } }),
  delayRisk: (airport, date) => 
    apiClient.get('/api/insights/delay', { params: { airport, date } }),
}

