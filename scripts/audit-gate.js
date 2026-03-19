#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];

function runAudit(workspace) {
  const args = ['audit', '--json'];
  if (workspace) {
    args.push('--workspace', workspace);
  }

  const result = spawnSync(`npm ${args.join(' ')}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  // npm audit often exits non-zero when vulnerabilities are found. We parse JSON regardless.
  const output = (result.stdout || '').trim();
  if (!output) {
    throw new Error(
      `npm audit returned no JSON for workspace ${workspace || 'root'}${result.stderr ? `: ${result.stderr}` : ''}`,
    );
  }

  let report;
  try {
    report = JSON.parse(output);
  } catch (error) {
    throw new Error(
      `Failed to parse npm audit JSON for workspace ${workspace || 'root'}: ${error.message}\nOutput:\n${output}`,
    );
  }

  const counts = report?.metadata?.vulnerabilities;
  if (!counts) {
    throw new Error(`Missing vulnerability metadata for workspace ${workspace || 'root'}.`);
  }

  return counts;
}

function countAtOrAbove(counts, minimumSeverity) {
  const minimumIndex = SEVERITY_ORDER.indexOf(minimumSeverity);
  if (minimumIndex === -1) {
    throw new Error(`Invalid severity threshold: ${minimumSeverity}`);
  }

  return SEVERITY_ORDER.slice(minimumIndex).reduce((sum, severity) => {
    return sum + (counts[severity] || 0);
  }, 0);
}

function printSummary(label, counts, threshold) {
  const failing = countAtOrAbove(counts, threshold);
  const summary = `info=${counts.info || 0}, low=${counts.low || 0}, moderate=${counts.moderate || 0}, high=${counts.high || 0}, critical=${counts.critical || 0}`;
  console.log(`${label}: ${summary} | threshold=${threshold} => ${failing} failing`);
  return failing;
}

function main() {
  const mobileCounts = runAudit('mobile-app');
  const backendCounts = runAudit('backend-api');

  const mobileFailing = printSummary('mobile-app', mobileCounts, 'high');
  const backendFailing = printSummary('backend-api', backendCounts, 'critical');

  if (mobileFailing > 0 || backendFailing > 0) {
    process.exit(1);
  }
}

main();
