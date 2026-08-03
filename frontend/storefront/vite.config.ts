import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Storefront (cliente) — puerto 5173
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // En desarrollo, las llamadas a /api y /media se redirigen al backend Django
      "/api": "http://localhost:8000",
      "/media": "http://localhost:8000",
    },
  },
});
