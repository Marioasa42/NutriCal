/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // El dominio es código puro: no necesita DOM. Cuando la fase 1 traiga
    // componentes, se añadirá un entorno jsdom solo para esos archivos.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    // La zona horaria se fija a UTC a propósito. Sin esto, la suite hereda la
    // del equipo: en Madrid pasarían tests que en la CI, que corre en UTC,
    // fallarían. Con la zona fijada, cualquier dependencia accidental del reloj
    // local falla en todas partes o en ninguna.
    env: { TZ: 'UTC' },
  },
});
