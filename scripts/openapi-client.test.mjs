import test from 'node:test';
import assert from 'node:assert/strict';

import { splitOpenApiSpecByModule } from './openapi-client.mjs';

test('splitOpenApiSpecByModule groups operations by tag and keeps untagged ops in core', () => {
  const spec = {
    openapi: '3.1.0',
    info: { title: 'x', version: '1' },
    paths: {
      '/accounts': {
        get: { operationId: 'listAccounts', tags: ['accounts'] },
      },
      '/jobs': {
        get: { operationId: 'listJobs', tags: ['jobs'] },
      },
      '/healthz': {
        get: { operationId: 'healthz' },
      },
    },
    components: { schemas: {} },
  };

  const modules = splitOpenApiSpecByModule(spec);

  assert.deepEqual(Object.keys(modules).sort(), ['accounts', 'core', 'jobs']);
  assert.deepEqual(Object.keys(modules.accounts.paths), ['/accounts']);
  assert.deepEqual(Object.keys(modules.jobs.paths), ['/jobs']);
  assert.deepEqual(Object.keys(modules.core.paths), ['/healthz']);
  assert.equal(modules.accounts.info.title, 'x');
});
