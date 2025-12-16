import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path, // 保持路径不变
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/socket.io': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
      // Google API 代理（避免 CORS 问题）
      '/google-api': {
        target: 'https://www.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/google-api/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // 添加 CORS 头
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
            console.log('[Proxy] Google API 请求:', req.url, '->', proxyRes.statusCode);
          });
        },
      },
      // Red5 HLS 프록시 (CORS 문제 해결용)
      '/red5-hls': {
        target: 'http://192.168.45.48:5080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/red5-hls/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // CORS 헤더 추가
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type';
            console.log('[Proxy] Red5 HLS 요청:', req.url, '->', proxyRes.statusCode);
          });
        },
      },
    },
  },
})

