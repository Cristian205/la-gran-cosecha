import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Panel administrativo — puerto 5174
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:8000",
      "/media": "http://localhost:8000",
    },
  },
});
