import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
// vitest/config re-export defineConfig của vite + types cho block `test`
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // vitest — logic thuần (store/persistence/providers) chạy trong node env,
  // DOM phụ được stub trong từng test file (xem *.test.ts).
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  build: {
    rolldownOptions: {
      output: {
        // Split the react runtime (changes independently of app code) into its
        // own long-term-cacheable chunk. Konva already splits via the dynamic
        // import() of CanvasStage in App.tsx.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
