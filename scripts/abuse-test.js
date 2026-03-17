#!/usr/bin/env node

const baseUrl = process.env.ABUSE_TEST_BASE_URL;
if (!baseUrl) {
  console.error('ABUSE_TEST_BASE_URL is required, for example: http://localhost:4000/api/v1');
  process.exit(1);
}

const endpointPath = process.env.ABUSE_TEST_PATH || '/auth/forgot-password';
const attempts = Number(process.env.ABUSE_TEST_ATTEMPTS || 14);
const expectedStatus = Number(process.env.ABUSE_TEST_EXPECTED_STATUS || 429);

let body;
try {
  body = process.env.ABUSE_TEST_BODY
    ? JSON.parse(process.env.ABUSE_TEST_BODY)
    : { email: 'rate-limit-check@example.com' };
} catch (error) {
  console.error('ABUSE_TEST_BODY must be valid JSON.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
};

if (process.env.ABUSE_TEST_BEARER_TOKEN) {
  headers.Authorization = `Bearer ${process.env.ABUSE_TEST_BEARER_TOKEN}`;
}

async function run() {
  let firstExpectedStatusAttempt = null;
  let statusHistogram = {};

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(`${baseUrl}${endpointPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    statusHistogram[response.status] = (statusHistogram[response.status] ?? 0) + 1;
    if (response.status === expectedStatus && firstExpectedStatusAttempt === null) {
      firstExpectedStatusAttempt = attempt;
    }
  }

  const statuses = Object.entries(statusHistogram)
    .map(([status, count]) => `${status}:${count}`)
    .join(', ');

  console.log(`Abuse check responses: ${statuses}`);

  if (firstExpectedStatusAttempt === null) {
    console.error(
      `Expected status ${expectedStatus} was never observed across ${attempts} attempts at ${endpointPath}.`,
    );
    process.exit(1);
  }

  console.log(`Observed ${expectedStatus} on attempt ${firstExpectedStatusAttempt}. Rate limit appears active.`);
}

run().catch((error) => {
  console.error('Abuse test failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
