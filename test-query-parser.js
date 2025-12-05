import { parseQuery } from './dist/log-chaos-visualizer/browser/chunk-DRYZRSUD.js';

console.log('\n=== Testing Query Parser ===\n');
const tests = [
  'level=error',
  'level=error AND message.contains(api)',
  'message.matches(/timeout/i)',
  '(level=error OR level=fatal) AND environment=prod',
  'simple text search',
  'invalid == syntax',
];
tests.forEach((query) => {
  console.log(`Query: "${query}"`);
  try {
    const result = parseQuery(query);
    console.log(`  Legacy: ${result.isLegacyTextSearch}`);
    console.log(`  Valid: ${result.errors.length === 0}`);
    if (result.errors.length > 0) {
      result.errors.forEach((e) => console.log(`  Error: ${e.message}`));
    }
  } catch (e) {
    console.log(`  Exception: ${e.message}`);
  }
  console.log('');
});
