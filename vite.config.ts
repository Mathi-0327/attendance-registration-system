import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

// ── PWA manifest generation (inline — avoids vite-plugin-pwa dependency) ──
function pwaManifestPlugin() {
  return {
    name: "pwa-manifest",
    generateBundle() {
      (this as any).emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: JSON.stringify(
          {
            name: "AttendReg — Smart Attendance",
            short_name: "AttendReg",
            description: "Enterprise AI-powered attendance management platform",
            start_url: "/",
            display: "standalone",
            background_color: "#0f172a",
            theme_color: "#3b82f6",
            orientation: "portrait-primary",
            icons: [
              { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
              { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
            ],
            shortcuts: [
              {
                name: "Submit Attendance",
                short_name: "Attendance",
                url: "/attendance",
                icons: [{ src: "/icon-192.png", sizes: "192x192" }],
              },
              {
                name: "My Dashboard",
                short_name: "Dashboard",
                url: "/dashboard/student",
                icons: [{ src: "/icon-192.png", sizes: "192x192" }],
              },
            ],
            categories: ["education", "productivity"],
            lang: "en",
          },
          null,
          2
        ),
      });
    },
  };
}

// ── Service Worker plugin (inline workbox-free) ────────────────────────────
function serviceWorkerPlugin() {
  const SW_CONTENT = `
// AttendReg Service Worker — Offline-first caching strategy
const CACHE_NAME = 'attendreg-v1';
const STATIC_ASSETS = ['/', '/attendance', '/dashboard/student'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for API calls — fall through on failure
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — request queued' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }))
  );
});
  `.trim();

  return {
    name: "inline-service-worker",
    generateBundle() {
      (this as any).emitFile({
        type: "asset",
        fileName: "sw.js",
        source: SW_CONTENT,
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    metaImagesPlugin(),
    pwaManifestPlugin(),
    serviceWorkerPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "frontend", "src"),
      "@shared/types": path.resolve(process.cwd(), "shared/types.ts"),
      "@shared": path.resolve(process.cwd(), "database"),
      "@assets": path.resolve(process.cwd(), "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(process.cwd(), "frontend"),
  build: {
    outDir: path.resolve(process.cwd(), "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Code-split large chunks for faster initial load
        manualChunks: {
          vendor: ["react", "react-dom"],
          charts: ["recharts"],
          motion: ["framer-motion"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-tabs", "@radix-ui/react-select"],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
