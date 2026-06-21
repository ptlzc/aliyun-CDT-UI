import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(rootDir, 'src', 'lib', 'api');
const generatedDir = path.join(apiDir, 'generated');
const specSource = process.env.OPENAPI_SWAGGER_URL || 'http://127.0.0.1:8080/api/swagger.json';

export function splitOpenApiSpecByModule(spec) {
  const modules = new Map();
  const baseSpec = {
    ...spec,
    paths: {},
  };

  for (const [route, methods] of Object.entries(spec.paths || {})) {
    const routeMethods = Object.entries(methods || {}).filter(([key]) => ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'].includes(key));
    const tags = new Set();
    for (const [, op] of routeMethods) {
      for (const tag of op?.tags || []) {
        tags.add(tag);
      }
    }
    const targetTags = tags.size > 0 ? [...tags] : ['core'];
    for (const tag of targetTags) {
      if (!modules.has(tag)) {
        modules.set(tag, {
          ...baseSpec,
          paths: {},
        });
      }
      modules.get(tag).paths[route] = methods;
    }
  }

  return Object.fromEntries([...modules.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function fetchSpec(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch swagger: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function runOpenapiTs(input, outputDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['--yes', '@hey-api/openapi-ts', '-i', input, '-o', outputDir],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0',
        },
        stdio: 'inherit',
      },
    );
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`openapi-ts exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

async function writeModuleEntry(tag) {
  const moduleDir = path.join(apiDir, tag);
  const moduleGeneratedDir = path.join(generatedDir, tag);
  await mkdir(moduleDir, { recursive: true });
  await mkdir(moduleGeneratedDir, { recursive: true });
  await writeFile(
    path.join(moduleDir, 'index.ts'),
    `export * from '../generated/${tag}/sdk.gen';\nexport * from '../generated/${tag}/types.gen';\n`,
    'utf8',
  );
}

export async function generateOpenApiClient() {
  const spec = await fetchSpec(specSource);
  const modules = splitOpenApiSpecByModule(spec);
  await rm(generatedDir, { recursive: true, force: true });
  await mkdir(generatedDir, { recursive: true });

  for (const [tag, moduleSpec] of Object.entries(modules)) {
    const inputPath = path.join(generatedDir, `${tag}.json`);
    const outputPath = path.join(generatedDir, tag);
    await writeFile(inputPath, JSON.stringify(moduleSpec, null, 2), 'utf8');
    await runOpenapiTs(inputPath, outputPath);
    await writeModuleEntry(tag);
  }

  await writeFile(
    path.join(apiDir, 'index.ts'),
    Object.keys(modules).map((tag) => `export * from './${tag}';`).join('\n') + '\n',
    'utf8',
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateOpenApiClient();
}
