import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './',
  base: './', // Relative base path for static deployment
  resolve: {
    alias: {
      '@': resolve(__dirname, './shared/assets/js'),
      '@css': resolve(__dirname, './shared/assets/css'),
      '@data': resolve(__dirname, './shared/data')
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        aids: resolve(__dirname, '01_aids/index.html'),
        tuberculosis: resolve(__dirname, '02_tuberculosis/index.html'),
        malariae: resolve(__dirname, '03_malariae/index.html')
      }
    }
  },
  server: {
    open: true
  }
});
