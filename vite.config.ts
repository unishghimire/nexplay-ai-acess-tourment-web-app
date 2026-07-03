import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');

            if (!normalizedId.includes('node_modules')) return;
            if (normalizedId.includes('/react@') || normalizedId.includes('/node_modules/react/')) return 'react-core';
            if (normalizedId.includes('/react-dom@') || normalizedId.includes('/scheduler@') || normalizedId.includes('/node_modules/react-dom/')) return 'react-dom-vendor';
            if (normalizedId.includes('/react-router') || normalizedId.includes('/@remix-run')) return 'router-vendor';
            if (normalizedId.includes('/lucide-react')) return 'icons-vendor';
            if (normalizedId.includes('/react-helmet-async')) return 'helmet-vendor';
            if (normalizedId.includes('/react-google-recaptcha') || normalizedId.includes('/recaptcha')) return 'recaptcha-vendor';
            if (normalizedId.includes('/@firebase/firestore') || normalizedId.includes('/firebase/firestore')) return 'firebase-firestore';
            if (normalizedId.includes('/@firebase/auth') || normalizedId.includes('/firebase/auth')) return 'firebase-auth';
            if (normalizedId.includes('/@firebase/storage') || normalizedId.includes('/firebase/storage')) return 'firebase-storage';
            if (normalizedId.includes('/@firebase/analytics') || normalizedId.includes('/firebase/analytics')) return 'firebase-analytics';
            if (normalizedId.includes('/@firebase') || normalizedId.includes('/firebase/')) return 'firebase-core';
            if (normalizedId.includes('/recharts') || normalizedId.includes('/d3-') || normalizedId.includes('/victory-vendor')) return 'charts-vendor';
            if (normalizedId.includes('/@hello-pangea') || normalizedId.includes('/dnd')) return 'dnd-vendor';
            return 'vendor';
          },
        },
      },
    },
  };
});
