import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Сайт опубликован на GitHub Pages: https://dsv-v.github.io/Billing/
  // Без этого параметра файлы не находятся и страница пустая.
  base: '/Billing/',
});
