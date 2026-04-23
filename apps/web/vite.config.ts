import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Auto-inject tokens dans chaque *.module.scss et *.scss,
        // SAUF tokens.scss et fonts.scss (évite références circulaires).
        additionalData: (content: string, filename: string) => {
          if (filename.endsWith('tokens.scss') || filename.endsWith('fonts.scss')) {
            return content;
          }
          return `@use "@/styles/tokens" as tokens;\n${content}`;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
