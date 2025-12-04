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
          src: '01_aids/data/*.{json,csv}',
          dest: '01_aids/data'
        },
        {
          src: '01_aids/thumb/*.{jpg,jpeg,png,webp}',
          dest: '01_aids/thumb'
        },
        {
          src: '01_aids/assets/images/*.{jpg,jpeg,png,svg,webp}',
          dest: '01_aids/assets/images'
        },
        {
          src: '02_tuberculosis/data/*.{json,csv}',
          dest: '02_tuberculosis/data'
        },
        {
          src: '02_tuberculosis/thumb/*.{jpg,jpeg,png,webp}',
          dest: '02_tuberculosis/thumb'
        },
        {
          src: '02_tuberculosis/assets/images/*.{jpg,jpeg,png,svg,webp}',
          dest: '02_tuberculosis/assets/images'
        },
        {
          src: '03_malariae/data/*.{json,csv}',
          dest: '03_malariae/data'
        },
        {
          src: '03_malariae/thumb/*.{jpg,jpeg,png,webp}',
          dest: '03_malariae/thumb'
        },
        {
          src: '03_malariae/assets/images/*.{jpg,jpeg,png,svg,webp}',
          dest: '03_malariae/assets/images'
        }
      ]
    })
  ]
});
