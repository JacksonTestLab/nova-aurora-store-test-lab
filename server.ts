import 'dotenv/config';
import path from 'path';
import express from 'express';
import { getActiveDatabaseMode, repo } from './src/db/repo.ts';
import { seedDatabase } from './src/db/seed.ts';
import { getSupabaseStatus } from './src/lib/supabase-server.ts';
import authRoutes from './src/server/routes/auth.ts';
import adminRoutes from './src/server/routes/admin.ts';
import pdvRoutes from './src/server/routes/pdv.ts';
import storeRoutes from './src/server/routes/store.ts';
import { openApiSpec } from './src/server/swagger.ts';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));

// Always serve generated product images and local upload fallback cleanly in both dev and production
app.use(
  '/src/assets/images',
  express.static(path.join(process.cwd(), 'src', 'assets', 'images'))
);
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'public', 'uploads'))
);

// Always serve self-hosted Swagger UI static assets cleanly in both dev and production
app.use(
  '/swagger-ui',
  express.static(path.join(process.cwd(), 'public', 'swagger-ui'))
);

// Lazy idempotent database seed on first API call
let seededOnce = false;
let seedInFlight: Promise<void> | null = null;

async function ensureSeeded() {
  if (seededOnce) return;
  if (!seedInFlight) {
    seedInFlight = (async () => {
      try {
        await seedDatabase(false);
        seededOnce = true;
      } catch (err) {
        console.error('Lazy seed error:', err);
      } finally {
        seedInFlight = null;
      }
    })();
  }
  await seedInFlight;
}

// Controlled lab delay middleware (0ms by default; configurable in /admin -> Laboratório)
app.use('/api', async (req, _res, next) => {
  await ensureSeeded();
  if (req.path === '/config' || req.path.startsWith('/admin/lab-settings')) {
    return next();
  }
  try {
    const setting = await repo.findOneWhere('lab_settings', { key: 'simulatedDelayMs' });
    const delayMs = Number(setting?.value || '0');
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 5000)));
    }
  } catch {
    // ignore delay check failure
  }
  return next();
});

// Swagger / OpenAPI docs for Postman & API QA (Vercel-safe self-hosted UI)
app.get('/api-docs.json', (_req, res) => {
  res.json(openApiSpec);
});

const swaggerHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nova Aurora Store · API Swagger QA</title>
  <link rel="icon" type="image/png" href="/swagger-ui/favicon-32x32.png" sizes="32x32" />
  <link rel="icon" type="image/png" href="/swagger-ui/favicon-16x16.png" sizes="16x16" />
  <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; font-family: system-ui, -apple-system, sans-serif; }
    .swagger-fallback-error { max-width: 720px; margin: 48px auto; padding: 24px; background: #fff; border: 1px solid #fecaca; border-radius: 12px; color: #991b1b; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/swagger-ui/swagger-ui-bundle.js"></script>
  <script src="/swagger-ui/swagger-ui-standalone-preset.js"></script>
  <script>
    window.addEventListener('load', function () {
      if (typeof SwaggerUIBundle !== 'function') {
        document.getElementById('swagger-ui').innerHTML =
          '<div class="swagger-fallback-error"><strong>Não foi possível carregar os scripts do Swagger UI.</strong><p>Acesse diretamente a especificação OpenAPI em <a href="/api-docs.json">/api-docs.json</a>.</p></div>';
        return;
      }
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(openApiSpec).replace(/</g, '\\u003c')},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: 'StandaloneLayout'
      });
    });
  </script>
</body>
</html>`;

app.get(['/api-docs', '/api-docs/'], (_req, res) => {
  res.status(200).type('text/html; charset=utf-8').send(swaggerHtml);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Nova Aurora Store',
    databaseMode: getActiveDatabaseMode(),
    supabase: getSupabaseStatus(),
  });
});

// API Routes
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pdv', pdvRoutes);
app.use('/api/store', storeRoutes);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nova Aurora Store rodando na porta ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
export default app;
