import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { allowedOrigins, isOriginAllowed } from './config/cors';
import { uploadsDir } from './config/uploads';
import { AllExceptionsFilter } from './common/logging/all-exceptions.filter';
import { resolveLogLevels } from './common/logging/log-levels';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: resolveLogLevels(),
    cors: {
      // Disallowed origins get `false` rather than a thrown Error: the browser
      // blocks the response either way (no Access-Control-Allow-Origin header),
      // but this avoids answering every stray cross-origin probe with a 500.
      origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
      credentials: true,
      // Without this the browser re-runs the OPTIONS preflight before EVERY
      // call, doubling the round trips on a link where latency dominates.
      // Chrome caps the cache at 2h regardless of the value.
      maxAge: 86_400,
    },
  });

  // Express adds an ETag to every JSON response but no Cache-Control. With no
  // explicit directive the browser falls back to *heuristic* caching and may
  // serve a stale body without revalidating at all — which is why an approved
  // booking only appeared after a manual refresh. This is a live schedule API,
  // so nothing it returns should ever be cached.
  app.set('etag', false);
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Uploaded PDFs are immutable once written, so leave those cacheable.
    if (!req.path.startsWith('/uploads/')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  // Nothing should fail silently: this logs 5xx with a stack trace and returns
  // a consistent error body for everything else.
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields from incoming DTOs
      transform: true, // auto-transform payloads into DTO instances
      forbidNonWhitelisted: true,
    }),
  );

  // Serve uploaded Surat Permohonan PDFs statically at /uploads/*.
  // In production UPLOADS_DIR points at a mounted Railway volume so the files
  // survive redeploys (the container filesystem itself is ephemeral).
  const dir = uploadsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  app.useStaticAssets(dir, { prefix: '/uploads' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`Parish booking API listening on port ${port}`);
  logger.log(`Uploads directory: ${dir}`);
  logger.log(`Allowed CORS origins: ${allowedOrigins().join(', ') || '(none configured)'}`);
  logger.log(`Log level: ${process.env.LOG_LEVEL ?? 'log'}`);
}

bootstrap().catch((err) => {
  // Without this a failure during bootstrap exits with an unhandled rejection
  // and no usable message in the deploy logs.
  new Logger('Bootstrap').error('Failed to start application', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
