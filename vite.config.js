import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
    outDir: 'docs',
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
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'shared/config/*.json',
          dest: 'shared/config'
        },
        {
          src: 'shared/data/*.json',
          dest: 'shared/data'
        },
        {
          src: 'public/01_aids/config/*.json',
          dest: '01_aids/config'
        },
        {
          src: 'public/01_aids/data/*.json',
          dest: '01_aids/data'
        },
        {
          src: 'public/02_tuberculosis/config/*.json',
          dest: '02_tuberculosis/config'
        },
        {
          src: 'public/02_tuberculosis/data/*.json',
          dest: '02_tuberculosis/data'
        },
        {
          src: 'public/03_malariae/config/*.json',
          dest: '03_malariae/config'
        },
        {
          src: 'public/03_malariae/data/*.json',
          dest: '03_malariae/data'
        }
      ]
    })
  ]
});
