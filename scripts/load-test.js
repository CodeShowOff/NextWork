#!/usr/bin/env node
const autocannon = require('autocannon');

const baseUrl = process.env.LOAD_TEST_BASE_URL;
if (!baseUrl) {
  console.error('LOAD_TEST_BASE_URL is required, for example: http://localhost:3000/api/v1');
  process.exit(1);
}

const headers = process.env.LOAD_TEST_BEARER_TOKEN
  ? { Authorization: `Bearer ${process.env.LOAD_TEST_BEARER_TOKEN}` }
  : {};

const scenarios = [
  { name: 'feed', path: '/feed?limit=20', connections: 20, duration: 30, latencyBudgetMs: 300 },
  { name: 'search', path: '/search?q=work&limit=10', connections: 15, duration: 30, latencyBudgetMs: 350 },
  { name: 'messages', path: '/messages/conversations?limit=20', connections: 15, duration: 30, latencyBudgetMs: 400 },
];

function runScenario(scenario) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url: `${baseUrl}${scenario.path}`,
        method: 'GET',
        headers,
        connections: scenario.connections,
        duration: scenario.duration,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          name: scenario.name,
          p95: result.latency.p95,
          non2xx: result.non2xx,
          requestsAverage: result.requests.average,
          budget: scenario.latencyBudgetMs,
        });
      },
    );
  });
}

(async () => {
  const outputs = [];
  for (const scenario of scenarios) {
    const result = await runScenario(scenario);
    outputs.push(result);
  }

  const failing = outputs.filter((item) => item.p95 > item.budget || item.non2xx > 0);
  for (const item of outputs) {
    console.log(
      `[${item.name}] p95=${item.p95}ms budget=${item.budget}ms non2xx=${item.non2xx} req/s=${item.requestsAverage}`,
    );
  }

  if (failing.length > 0) {
    console.error('Load test failed budgets for:', failing.map((item) => item.name).join(', '));
    process.exit(1);
  }

  console.log('Load test budgets passed.');
})();
