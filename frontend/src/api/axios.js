import axios from 'axios'

/*
  GHI CHÚ VẤN ĐÁP:
  File này cấu hình axios để frontend gọi API backend FastAPI.
  Vai trò:
  - Ở môi trường dev, frontend gọi các endpoint dạng /api/... qua proxy Vite.
  - Ở production, có thể dùng VITE_API_URL hoặc mặc định http://127.0.0.1:8000.
  - Interceptor response xử lý trường hợp backend trả 401 thì xóa user và đưa về trang đăng nhập.
  Khi thầy hỏi frontend gọi backend ở đâu:
  - Các trang React import object api từ file này rồi gọi api.get hoặc api.post.
*/

// Dev: dùng proxy Vite (/api -> :8000). Production: VITE_API_URL hoặc 127.0.0.1:8000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://127.0.0.1:8000'),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
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
      // Nếu 401 Unauthorized, xóa phiên đăng nhập và chuyển về /login
      localStorage.removeItem('user')
      localStorage.removeItem('access_token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
