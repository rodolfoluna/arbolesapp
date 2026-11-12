import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// En GitHub Pages la app vive en https://<usuario>.github.io/<repo>/
// El workflow define BASE_PATH=/<repo>/ ; en local se usa "/".
const base = process.env.BASE_PATH || '/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const central = env.VITE_AUTH_MODE === 'central';
  const apiOrigin = env.VITE_EDUCATIONAL_API_URL ? new URL(env.VITE_EDUCATIONAL_API_URL).origin : '';
  return {
  server: { port: 5173, strictPort: true },
  base,
  plugins: [
    ...(central ? [{ name: 'central-security-policy', transformIndexHtml: (html: string) => html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://aula-identidad.onrender.com https://vtriyoxcumuygluqqstd.supabase.co ${apiOrigin}; object-src 'none'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer">`) }] : []),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'Árboles Binarios · Aula',
        short_name: 'Árboles',
        description: 'Construye árboles binarios, BST y AVL a mano y recibe evaluación automática, incluso sin conexión.',
        lang: 'es-MX',
        theme_color: '#070b14',
        background_color: '#070b14',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        categories: ['education'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Toda la interfaz (JS, CSS, fuentes, íconos) queda en caché para funcionar sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/[?&](?:auth_callback|code|state|access_token|id_token)=/, /\/api\//],
        // Authentication, directory and protected API responses are never runtime-cached.
        runtimeCaching: [],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1200,
  },
  };
});
