/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build mono-fichier : dist/index.html contient tout le JS et le CSS, et s'ouvre
// directement depuis le disque (file://), sans serveur.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  test: {
    globals: true,
    environment: 'node',
  },
});
