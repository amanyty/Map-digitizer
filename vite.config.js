import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/*.zip', '**/node_modules/**', '**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.geojson']
    }
  }
});
