/**
 * Synthetic Test Data Generator for Log Chaos Visualizer
 *
 * Generates random, realistic test data for all supported log formats:
 * - Pino
 * - Winston
 * - Loki
 * - Docker
 * - Promtail
 * - Text
 * - Unknown JSON
 *
 * Usage:
 *   node generate-test-data.js [options]
 *
 * Options:
 *   --format <format>  - Generate specific format (pino, winston, loki, docker, promtail, text, mixed)
 *   --count <number>   - Number of entries to generate (default: 100)
 *   --output <file>    - Output file (default: test-logs.jsonl)
 *   --seed <number>    - Random seed for reproducibility
 */

const fs = require('fs');
const path = require('path');

// Configuration
const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
const ENVIRONMENTS = ['dev', 'staging', 'prod'];
const HOSTNAMES = [
  'api-prod-1',
  'api-prod-2',
  'api-staging-1',
  'api-dev-1',
  'db-prod-1',
  'db-staging-1',
  'db-dev-1',
  'cache-prod-1',
  'cache-staging-1',
  'cache-dev-1',
  'worker-prod-1',
  'worker-staging-1',
  'worker-dev-1',
];
const SERVICES = ['api', 'auth', 'database', 'cache', 'worker', 'payment', 'notification'];
const MESSAGES = [
  'Request processed successfully',
  'Database query executed',
  'Cache hit for key: {key}',
  'API call to external service',
  'User authentication attempt',
  'Payment processing started',
  'Email notification sent',
  'Connection timeout after {time}ms',
  'Invalid request parameters',
  'Retry attempt {attempt} of {max}',
  'Resource not found: {resource}',
  'Permission denied for user: {userId}',
  'Internal server error occurred',
  'Batch job completed with {count} items',
  'Memory usage: {usage}MB',
];
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const ENDPOINTS = [
  '/api/users',
  '/api/products',
  '/api/orders',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/payments',
  '/api/notifications',
  '/api/settings',
];
const HTTP_STATUS_CODES = [200, 201, 204, 301, 302, 400, 401, 403, 404, 409, 429, 500, 502, 503];

// Utility functions
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getRandomTimestamp(daysAgo = 7) {
  const now = Date.now();
  const past = now - daysAgo * 24 * 60 * 60 * 1000;
  return new Date(getRandomInt(past, now)).toISOString();
}

function normalizeLevel(level) {
  const pinoLevels = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
  if (typeof level === 'string') {
    return pinoLevels[level] || 30;
  }
  return level;
}

function fillTemplate(template, context) {
  return template.replace(/{(\w+)}/g, (match, key) => context[key] || match);
}

// Pino format generator
function generatePinoEntry() {
  const level = getRandomElement(LOG_LEVELS);
  const environment = getRandomElement(ENVIRONMENTS);
  const hostname = getRandomElement(HOSTNAMES);
  const service = getRandomElement(SERVICES);
  const timestamp = new Date();

  const baseEntry = {
    time: timestamp.getTime(),
    level: normalizeLevel(level),
    pid: getRandomInt(1000, 99999),
    hostname: hostname,
    name: service,
    msg: fillTemplate(getRandomElement(MESSAGES), {
      key: `cache_${getRandomInt(1, 100)}`,
      time: getRandomInt(100, 5000),
      attempt: getRandomInt(1, 3),
      max: 3,
      resource: `resource_${getRandomInt(1, 50)}`,
      userId: `user_${getRandomInt(1, 1000)}`,
      count: getRandomInt(10, 1000),
      usage: getRandomInt(100, 5000),
    }),
  };

  // Sometimes add HTTP fields
  if (Math.random() > 0.5) {
    baseEntry.req = {
      id: `req_${getRandomInt(1000000, 9999999)}`,
      method: getRandomElement(HTTP_METHODS),
      url: getRandomElement(ENDPOINTS),
      remoteAddress: `192.168.${getRandomInt(1, 254)}.${getRandomInt(1, 254)}`,
    };
    baseEntry.res = {
      statusCode: getRandomElement(HTTP_STATUS_CODES),
      responseTimeMs: getRandomInt(10, 2000),
    };
  }

  // Sometimes add metadata
  if (Math.random() > 0.7) {
    baseEntry.meta = {
      requestId: `req_${getRandomInt(100000, 999999)}`,
      userId: `user_${getRandomInt(1, 10000)}`,
      environment: environment,
      tags: getRandomElements(['important', 'retry', 'cache', 'external', 'critical'], getRandomInt(1, 3)),
    };
  }

  return baseEntry;
}

// Winston format generator
function generateWinstonEntry() {
  const level = getRandomElement(LOG_LEVELS);
  const environment = getRandomElement(ENVIRONMENTS);

  return {
    timestamp: getRandomTimestamp().split('T')[0] + 'T' + getRandomTimestamp().split('T')[1],
    level: level,
    message: fillTemplate(getRandomElement(MESSAGES), {
      key: `cache_${getRandomInt(1, 100)}`,
      time: getRandomInt(100, 5000),
      attempt: getRandomInt(1, 3),
      max: 3,
      resource: `resource_${getRandomInt(1, 50)}`,
      userId: `user_${getRandomInt(1, 1000)}`,
      count: getRandomInt(10, 1000),
      usage: getRandomInt(100, 5000),
    }),
    meta: {
      requestId: `req_${getRandomInt(100000, 999999)}`,
      userId: `user_${getRandomInt(1, 10000)}`,
      traceId: `trace_${getRandomInt(100000, 999999)}`,
      service: getRandomElement(SERVICES),
      environment: environment,
    },
  };
}

// Loki format generator
function generateLokiEntry() {
  const level = getRandomElement(LOG_LEVELS);
  const environment = getRandomElement(ENVIRONMENTS);

  return {
    ts: getRandomTimestamp(),
    labels: {
      job: getRandomElement(SERVICES),
      instance: `instance_${getRandomInt(1, 10)}`,
      app: getRandomElement(SERVICES),
      environment: environment,
      level: level,
    },
    line: fillTemplate(getRandomElement(MESSAGES), {
      key: `cache_${getRandomInt(1, 100)}`,
      time: getRandomInt(100, 5000),
      attempt: getRandomInt(1, 3),
      max: 3,
      resource: `resource_${getRandomInt(1, 50)}`,
      userId: `user_${getRandomInt(1, 1000)}`,
      count: getRandomInt(10, 1000),
      usage: getRandomInt(100, 5000),
    }),
  };
}

// Docker format generator
function generateDockerEntry() {
  const level = getRandomElement(LOG_LEVELS);

  return {
    log: fillTemplate(`[${level.toUpperCase()}] ` + getRandomElement(MESSAGES), {
      key: `cache_${getRandomInt(1, 100)}`,
      time: getRandomInt(100, 5000),
      attempt: getRandomInt(1, 3),
      max: 3,
      resource: `resource_${getRandomInt(1, 50)}`,
      userId: `user_${getRandomInt(1, 1000)}`,
      count: getRandomInt(10, 1000),
      usage: getRandomInt(100, 5000),
    }),
    stream: Math.random() > 0.8 ? 'stderr' : 'stdout',
    time: getRandomTimestamp(),
  };
}

// Promtail format generator
function generatePromtailEntry() {
  const level = getRandomElement(LOG_LEVELS);

  return {
    ts: getRandomTimestamp(),
    level: level,
    message: fillTemplate(getRandomElement(MESSAGES), {
      key: `cache_${getRandomInt(1, 100)}`,
      time: getRandomInt(100, 5000),
      attempt: getRandomInt(1, 3),
      max: 3,
      resource: `resource_${getRandomInt(1, 50)}`,
      userId: `user_${getRandomInt(1, 1000)}`,
      count: getRandomInt(10, 1000),
      usage: getRandomInt(100, 5000),
    }),
  };
}

// Text format generator
function generateTextEntry() {
  const level = getRandomElement(LOG_LEVELS);
  const timestamp = getRandomTimestamp();
  const hostname = getRandomElement(HOSTNAMES);
  const service = getRandomElement(SERVICES);

  return fillTemplate(
    `${timestamp} ${hostname} ${service}[${getRandomInt(1000, 99999)}]: [${level.toUpperCase()}] ` +
      getRandomElement(MESSAGES),
    {
      key: `cache_${getRandomInt(1, 100)}`,
      time: getRandomInt(100, 5000),
      attempt: getRandomInt(1, 3),
      max: 3,
      resource: `resource_${getRandomInt(1, 50)}`,
      userId: `user_${getRandomInt(1, 1000)}`,
      count: getRandomInt(10, 1000),
      usage: getRandomInt(100, 5000),
    },
  );
}

// Unknown JSON format generator
function generateUnknownJsonEntry() {
  const timestamp = getRandomTimestamp();

  return {
    timestamp: timestamp,
    severity: getRandomElement(['DEBUG', 'INFO', 'WARNING', 'ERROR']),
    message: fillTemplate(getRandomElement(MESSAGES), {
      key: `cache_${getRandomInt(1, 100)}`,
      time: getRandomInt(100, 5000),
      attempt: getRandomInt(1, 3),
      max: 3,
      resource: `resource_${getRandomInt(1, 50)}`,
      userId: `user_${getRandomInt(1, 1000)}`,
      count: getRandomInt(10, 1000),
      usage: getRandomInt(100, 5000),
    }),
    source: getRandomElement(SERVICES),
    customField: `value_${getRandomInt(1, 100)}`,
    tags: getRandomElements(['tag1', 'tag2', 'tag3', 'tag4'], getRandomInt(1, 2)),
  };
}

// Main generator
function generateEntry(format) {
  switch (format) {
    case 'pino':
      return generatePinoEntry();
    case 'winston':
      return generateWinstonEntry();
    case 'loki':
      return generateLokiEntry();
    case 'docker':
      return generateDockerEntry();
    case 'promtail':
      return generatePromtailEntry();
    case 'text':
      return generateTextEntry();
    case 'unknown-json':
      return generateUnknownJsonEntry();
    case 'mixed':
    default:
      const formats = ['pino', 'winston', 'loki', 'docker', 'promtail', 'text', 'unknown-json'];
      return generateEntry(getRandomElement(formats));
  }
}

// Main function
function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let format = 'mixed';
  let count = 100;
  let outputFile = 'test-logs.jsonl';
  let seed = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && i + 1 < args.length) {
      format = args[++i];
    } else if (args[i] === '--count' && i + 1 < args.length) {
      count = parseInt(args[++i]);
    } else if (args[i] === '--output' && i + 1 < args.length) {
      outputFile = args[++i];
    } else if (args[i] === '--seed' && i + 1 < args.length) {
      seed = parseInt(args[++i]);
    }
  }

  // Set seed if provided
  if (seed !== null) {
    Math.random = (() => {
      let x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    })();
  }

  console.log(`\n📝 Generating ${count} test log entries (format: ${format})...`);
  console.log(`📁 Output file: ${outputFile}\n`);

  // Generate and write entries
  const entries = [];
  for (let i = 0; i < count; i++) {
    const entry = generateEntry(format);
    if (format === 'text') {
      entries.push(entry); // Text entries are strings
    } else {
      entries.push(JSON.stringify(entry));
    }
  }

  fs.writeFileSync(outputFile, entries.join('\n') + '\n');

  console.log(`✅ Successfully generated ${count} entries`);
  console.log(`📊 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
  console.log(`\n💡 Tip: Use this file to test the log visualizer`);
  console.log(`   Copy entries to your logs and refresh the viewer\n`);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateEntry,
  generatePinoEntry,
  generateWinstonEntry,
  generateLokiEntry,
  generateDockerEntry,
  generatePromtailEntry,
  generateTextEntry,
  generateUnknownJsonEntry,
};
