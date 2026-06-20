import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // em dev: serve em /   |   em build: usa o path do GitHub Pages
  base: command === 'build' ? '/arremate-app/' : '/',
}))
