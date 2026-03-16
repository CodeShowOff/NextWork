#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const requiredEnv = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
];

const backendEnvPath = path.resolve(__dirname, '../backend-api/.env');
let envContent = '';
if (fs.existsSync(backendEnvPath)) {
  envContent = fs.readFileSync(backendEnvPath, 'utf8');
}

function hasEnv(key) {
  if (process.env[key] && String(process.env[key]).trim()) {
    return true;
  }

  if (!envContent) {
    return false;
  }

  return new RegExp(`^${key}=.+`, 'm').test(envContent);
}

function readEnvValue(key) {
  if (process.env[key] && String(process.env[key]).trim()) {
    return String(process.env[key]).trim();
  }

  if (!envContent) {
    return '';
  }

  const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const missing = requiredEnv.filter((key) => !hasEnv(key));
const insecureSecrets = requiredEnv
  .filter((key) => /SECRET/.test(key))
  .filter((key) => /^(changeme|dev-secret|password)$/i.test(readEnvValue(key)));

if (missing.length > 0) {
  console.error('Missing required security env vars:', missing.join(', '));
  process.exit(1);
}

if (insecureSecrets.length > 0) {
  console.error('Insecure default secrets detected:', insecureSecrets.join(', '));
  process.exit(1);
}

console.log('Security preflight checks passed.');
