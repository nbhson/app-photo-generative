import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Split the react runtime (changes independently of app code) into its
        // own long-term-cacheable chunk. Konva already splits via the dynamic
        // import() of CanvasStage in App.tsx.
        advancedChunks: {
          groups: [
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
