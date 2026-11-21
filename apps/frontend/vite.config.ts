import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), {
    name: 'opportunity-page-entry',
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (index?.type === 'asset') {
        this.emitFile({ type: 'asset', fileName: 'opportunities/index.html', source: index.source });
      }
    }
  }],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'lucide-react']
        }
      }
    }
  }
})
