import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind()],
  server: { proxy: { '/api': 'http://localhost:5000' } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/html', '@tiptap/extension-placeholder'],
          'editor-extensions': [
            '@tiptap/extension-code-block-lowlight',
            '@tiptap/extension-table',
            '@tiptap/extension-table-cell',
            '@tiptap/extension-table-header',
            '@tiptap/extension-table-row',
            '@tiptap/extension-task-item',
            '@tiptap/extension-task-list',
            'lowlight',
            'highlight.js'
          ],
          'charts': ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    // Use esbuild for minification (faster and built-in)
    minify: 'esbuild',
  },
})
