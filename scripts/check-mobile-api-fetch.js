#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const apiDir = path.resolve(process.cwd(), 'mobile-app/src/shared/api');
const allowedFiles = new Set(['http.ts', 'media.api.ts']);
const violations = [];

for (const fileName of fs.readdirSync(apiDir)) {
  if (!fileName.endsWith('.ts')) {
    continue;
  }

  if (allowedFiles.has(fileName)) {
    continue;
  }

  const absolutePath = path.join(apiDir, fileName);
  const content = fs.readFileSync(absolutePath, 'utf8');

  if (/\bfetch\s*\(/.test(content)) {
    violations.push(path.relative(process.cwd(), absolutePath));
  }
}

if (violations.length > 0) {
  console.error('Direct fetch is not allowed in feature API files (except http.ts and media.api.ts).');
  console.error('Violations:\n- ' + violations.join('\n- '));
  process.exit(1);
}

console.log('Mobile API fetch policy check passed.');
