import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    // No sourcemaps in production to keep bundle lean
    sourcemap: false,

    rollupOptions: {
      output: {
        // Split vendor and app chunks for better long-term caching
        // manualChunks must be a function in Vite 8 (rolldown)
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/localforage')) {
            return 'vendor-ui';
          }
        },
      },
    },
  },
});
