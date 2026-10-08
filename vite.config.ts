import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { backendApiPlugin } from './server/backendPlugin.js';

export default defineConfig({
  plugins: [react(), backendApiPlugin()],
  server: {
    port: 5173,
    host: true,
  }
});
