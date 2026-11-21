import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), {
    name: 'workspace-page-entries',
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (index?.type === 'asset') {
        const routes = [
          'login', 'privacy', 'terms', 'dashboard', 'opportunities', 'leads',
          'conversations', 'phone-studio', 'follow-ups', 'tasks', 'handoff',
          'sdr-setup', 'analytics', 'billing', 'settings', 'admin', 'lead-simulator',
        ];
        for (const route of routes) {
          this.emitFile({ type: 'asset', fileName: route + '/index.html', source: index.source });
        }
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
