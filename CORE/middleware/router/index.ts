import { Application, Router } from 'express';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';

export interface DomainModule {
  name: string;
  path: string;
  router: Router;
}

export function mountRouters(app: Application, modules: DomainModule[]): void {
  const prefix = `/api/${config.apiVersion}`;

  for (const mod of modules) {
    const fullPath = `${prefix}${mod.path}`;
    app.use(fullPath, mod.router);
    logger.info({ domain: mod.name, path: fullPath }, 'ROUTE_READY');
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: config.apiVersion, timestamp: new Date().toISOString() });
  });

  logger.info({ prefix }, 'All routes mounted');
}
