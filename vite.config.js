import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Sortir Paket App',
        short_name: 'Sortir App',
        description: 'Aplikasi untuk Sortir Paket',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'logoapp.PNG',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logoapp.PNG',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
