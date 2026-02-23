import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar React y dependencias del núcleo
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Separar Firebase
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/storage'],
          // Separar Lucide icons (son muchos)
          'icons': ['lucide-react'],
          // Separar utilidades UI
          'ui-utils': ['class-variance-authority', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Aumentar el límite de advertencia a 1MB
    chunkSizeWarningLimit: 1000,
  },
})