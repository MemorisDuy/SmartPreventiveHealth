import axios from 'axios'

// Dev: dùng proxy Vite (/api -> :8000). Production: VITE_API_URL hoặc localhost:8000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:8000'),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Có thể thêm Authorization token ở đây nếu cần
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Nếu 401 Unauthorized, đăng xuất
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
