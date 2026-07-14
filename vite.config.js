import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/*.zip', '**/node_modules/**', '**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.geojson']
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        digitizer: resolve(__dirname, 'digitizer.html'),
      },
    },
  },
});
