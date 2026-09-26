import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const SERVER = 'http://localhost:3001';

// HTTPS=1 enables a self-signed cert so phones on the LAN can use the camera
// (getUserMedia requires a secure context outside localhost).
const https = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  server: {
    host: true, // listen on LAN so phones can join during dev
    proxy: {
      '/api': { target: SERVER, changeOrigin: true },
      '/socket.io': { target: SERVER, ws: true, changeOrigin: true },
    },
  },
});
