import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const specificationPath = fileURLToPath(new URL('../../docs/openapi.yaml', import.meta.url));

export const openApiDocument = parse(readFileSync(specificationPath, 'utf8'));

export const swaggerUiOptions = {
  customSiteTitle: 'Ticketing System API',
  explorer: true,
  swaggerOptions: {
    displayRequestDuration: true,
    filter: true,
    persistAuthorization: true,
    tryItOutEnabled: true,
  },
};
