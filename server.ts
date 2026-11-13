import 'dotenv/config';
import path from 'path';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
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

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Always serve generated product images cleanly in both dev and production
app.use(
  '/src/assets/images',
  express.static(path.join(process.cwd(), 'src', 'assets', 'images'))
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

// Swagger / OpenAPI docs for Postman & API QA
app.get('/api-docs.json', (_req, res) => {
  res.json(openApiSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Nova Aurora Store Test Lab',
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
    console.log(`Nova Aurora Store Test Lab rodando na porta ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
export default app;
