import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * In production, files in /api run as Vercel Functions.
 * In `npm run dev` this plugin runs the same files through Vite so the
 * chatbot and staff sign-up work locally without the Vercel CLI.
 */
function vercelApiInDev(): Plugin {
  return {
    name: 'sachiseva-api-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/')) return next();
        const name = url.slice(5).split('?')[0].replace(/[^a-z0-9-]/gi, '');
        try {
          const mod = await server.ssrLoadModule(path.resolve(__dirname, `api/${name}.ts`));
          const method = (req.method ?? 'GET').toUpperCase();
          const handler = mod[method] as ((r: Request) => Promise<Response>) | undefined;
          if (!handler) {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://localhost${url}`, {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          if (response.body) {
            const reader = response.body.getReader();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          }
          res.end();
        } catch (err) {
          console.error('[api]', err);
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });
    },
  };
}

/** Fills the service worker with every built file so the whole app works offline. */
function serviceWorkerPrecache(): Plugin {
  return {
    name: 'sachiseva-sw-precache',
    apply: 'build',
    writeBundle(options, bundle) {
      const dir = options.dir ?? 'dist';
      const files = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png',
        ...Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.html')).map((f) => `/${f}`)];
      const swPath = path.join(dir, 'sw.js');
      const src = fs.readFileSync(swPath, 'utf8');
      fs.writeFileSync(swPath, src.replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify([...new Set(files)])};`).replace("'__VERSION__'", `'${Date.now().toString(36)}'`));
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make non-VITE_ env vars (AI keys, service role) visible to /api in dev.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v;

  return {
    plugins: [react(), tailwindcss(), vercelApiInDev(), serviceWorkerPrecache()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            map: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
  };
});
