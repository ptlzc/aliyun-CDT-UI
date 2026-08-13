#!/usr/bin/env node
/**
 * Enforce the 600-line single-file limit under src/.
 *
 * Scans src/ recursively for *.ts / *.tsx, counts lines with the wc -l
 * convention (newline characters; blank lines and comments count), and
 * exits non-zero when any non-exempt file exceeds MAX_LINES.
 *
 * Exemptions (hey-api generated output, never hand-edited):
 *   - src/lib/api/generated.ts
 *   - src/lib/api/generated/**
 *
 * Paths are matched relative to src/ (e.g. lib/api/generated.ts).
 * Zero third-party dependencies; runs with plain Node.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 600;
const EXEMPT_PREFIXES = ['lib/api/generated.ts', 'lib/api/generated/'];

const srcDir = join(fileURLToPath(new URL('..', import.meta.url)), 'src');

function isExempt(relativePath) {
  return EXEMPT_PREFIXES.some((prefix) => relativePath === prefix || relativePath.startsWith(prefix));
}

function collectSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function countLines(filePath) {
  // wc -l counts newline characters; a file without a trailing newline still
  // counts its final line as a newline count of content lines.
  const content = readFileSync(filePath, 'utf8');
  let lines = 0;
  for (let i = 0; i < content.length; i += 1) {
    if (content.charCodeAt(i) === 10) {
      lines += 1;
    }
  }
  if (content.length > 0 && !content.endsWith('\n')) {
    lines += 1;
  }
  return lines;
}

const violations = [];
let scanned = 0;

for (const filePath of collectSourceFiles(srcDir)) {
  const rel = relative(srcDir, filePath).replaceAll('\\', '/');
  if (isExempt(rel)) {
    continue;
  }
  scanned += 1;
  const lines = countLines(filePath);
  if (lines > MAX_LINES) {
    violations.push({ rel, lines });
  }
}

if (violations.length > 0) {
  console.error(`check:size FAIL — ${violations.length} file(s) exceed ${MAX_LINES} lines:`);
  for (const { rel, lines } of violations.sort((a, b) => b.lines - a.lines)) {
    console.error(`  ${rel} (${lines} lines)`);
  }
  process.exit(1);
}

console.log(`check:size OK — ${scanned} source file(s) scanned, all within ${MAX_LINES} lines.`);
