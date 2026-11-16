import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tensorflow/tfjs-backend-webgpu': path.resolve(__dirname, './src/utils/mock-webgpu.js')
    }
  },
  optimizeDeps: {
    include: ['@splinetool/react-spline', '@splinetool/runtime']
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    open: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'tensorflow': [
            '@tensorflow/tfjs-core',
            '@tensorflow/tfjs-backend-webgl',
            '@tensorflow/tfjs-converter',
            '@tensorflow-models/face-landmarks-detection',
            '@tensorflow-models/pose-detection',
          ],
          'charts-maps': ['recharts', 'leaflet', 'react-leaflet'],
        },
      },
    },
  }
})

