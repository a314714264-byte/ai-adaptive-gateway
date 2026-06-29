import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3001,
    proxy: {
      '/v1': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/models': 'http://localhost:8000',
      '/channels': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
      '/settings': 'http://localhost:8000',
      '/api-info': 'http://localhost:8000',
    }
  },
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths()
  ],
})
