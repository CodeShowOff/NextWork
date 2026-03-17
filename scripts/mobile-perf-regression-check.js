#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function printUsage() {
  console.log(`Usage:
node ./scripts/mobile-perf-regression-check.js --baseline <file> --current <file> [--minDroppedFramesImprovement <number>] [--maxTtfcRegressionMs <number>] [--maxMemoryCrashIncrease <number>]

Input file shape:
{
  "label": "pixel7-release",
  "feed": {
    "droppedFramesPct": 18.5,
    "ttfcMs": 820,
    "memoryPressureCrashes": 0
  }
}
`);
}

function parseArgs(argv) {
  const args = {
    minDroppedFramesImprovement: 30,
    maxTtfcRegressionMs: 0,
    maxMemoryCrashIncrease: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key.startsWith('--')) {
      continue;
    }

    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${key}`);
    }

    switch (key) {
      case '--baseline':
        args.baseline = value;
        break;
      case '--current':
        args.current = value;
        break;
      case '--minDroppedFramesImprovement':
        args.minDroppedFramesImprovement = Number(value);
        break;
      case '--maxTtfcRegressionMs':
        args.maxTtfcRegressionMs = Number(value);
        break;
      case '--maxMemoryCrashIncrease':
        args.maxMemoryCrashIncrease = Number(value);
        break;
      default:
        throw new Error(`Unknown argument: ${key}`);
    }

    index += 1;
  }

  if (!args.baseline || !args.current) {
    throw new Error('Both --baseline and --current are required.');
  }

  return args;
}

function readMetrics(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Metrics file not found: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const droppedFramesPct = Number(data?.feed?.droppedFramesPct);
  const ttfcMs = Number(data?.feed?.ttfcMs);
  const memoryPressureCrashes = Number(data?.feed?.memoryPressureCrashes ?? 0);

  if (!Number.isFinite(droppedFramesPct) || droppedFramesPct < 0) {
    throw new Error(`Invalid feed.droppedFramesPct in ${filePath}`);
  }

  if (!Number.isFinite(ttfcMs) || ttfcMs < 0) {
    throw new Error(`Invalid feed.ttfcMs in ${filePath}`);
  }

  if (!Number.isFinite(memoryPressureCrashes) || memoryPressureCrashes < 0) {
    throw new Error(`Invalid feed.memoryPressureCrashes in ${filePath}`);
  }

  return {
    label: data.label ?? path.basename(filePath),
    feed: {
      droppedFramesPct,
      ttfcMs,
      memoryPressureCrashes,
    },
  };
}

function formatNumber(value) {
  return Number(value.toFixed(2));
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error.message || error));
    printUsage();
    process.exit(1);
  }

  let baseline;
  let current;

  try {
    baseline = readMetrics(args.baseline);
    current = readMetrics(args.current);
  } catch (error) {
    console.error(String(error.message || error));
    process.exit(1);
  }

  const droppedFramesImprovementPct =
    baseline.feed.droppedFramesPct === 0
      ? current.feed.droppedFramesPct === 0
        ? 0
        : -100
      : ((baseline.feed.droppedFramesPct - current.feed.droppedFramesPct) / baseline.feed.droppedFramesPct) * 100;

  const ttfcRegressionMs = current.feed.ttfcMs - baseline.feed.ttfcMs;
  const memoryCrashIncrease = current.feed.memoryPressureCrashes - baseline.feed.memoryPressureCrashes;

  const checks = [
    {
      name: 'Dropped frames improvement',
      passed: droppedFramesImprovementPct >= args.minDroppedFramesImprovement,
      detail: `${formatNumber(droppedFramesImprovementPct)}% (required >= ${args.minDroppedFramesImprovement}%)`,
    },
    {
      name: 'Feed TTFC regression',
      passed: ttfcRegressionMs <= args.maxTtfcRegressionMs,
      detail: `${formatNumber(ttfcRegressionMs)}ms (required <= ${args.maxTtfcRegressionMs}ms)`,
    },
    {
      name: 'Memory pressure crash increase',
      passed: memoryCrashIncrease <= args.maxMemoryCrashIncrease,
      detail: `${memoryCrashIncrease} (required <= ${args.maxMemoryCrashIncrease})`,
    },
  ];

  console.log(`Baseline: ${baseline.label}`);
  console.log(`Current: ${current.label}`);
  console.log('');

  for (const check of checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'} - ${check.name}: ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.passed);
  if (failed.length > 0) {
    console.error(`\nRegression checks failed (${failed.length}).`);
    process.exit(1);
  }

  console.log('\nAll mobile performance regression checks passed.');
}

main();
