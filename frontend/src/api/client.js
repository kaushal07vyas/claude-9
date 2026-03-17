import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001'

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response) {
      // Server responded with error
      return Promise.reject(error.response.data)
    } else if (error.request) {
      // Request made but no response
      return Promise.reject({ error: { message: 'Network error. Please check your connection.' } })
    } else {
      // Something else happened
      return Promise.reject({ error: { message: error.message } })
    }
  }
)

export default apiClient

