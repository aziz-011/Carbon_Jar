import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Build mono-fichier (JS et CSS intégrés) pour publication comme Artifact claude.ai. */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-artifact', emptyOutDir: true },
});
