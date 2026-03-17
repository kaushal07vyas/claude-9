import apiClient from './client'

export const flightInsightsApi = {
  // Flight-specific insights
  get: (flightId, targetDate = null) => {
    const params = {}
    if (targetDate) {
      params.target_date = targetDate
    }
    return apiClient.get(`/api/flight_insights/${encodeURIComponent(flightId)}`, { params })
  },
  
  // Route-level insights (unified API)
  priceGuidance: (origin, dest, date) => 
    apiClient.get('/api/flight_insights/route/price', { params: { origin, dest, date } }),
  
  delayRisk: (airport, date) => 
    apiClient.get('/api/flight_insights/route/delay', { params: { airport, date } }),
}

