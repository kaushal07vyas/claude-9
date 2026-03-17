import apiClient from './client'

export const authApi = {
  login: (email, password) => apiClient.post('/api/auth/login', { email, password }),
  signup: (data) => apiClient.post('/api/auth/signup', data),
}

