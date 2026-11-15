import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, Vite serves the React app and forwards /api/* to the Express server,
// so the browser only ever talks to one origin and never sees the API key.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
