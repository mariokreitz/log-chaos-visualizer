import type { ParsedLogEntry } from '../types/file-parse.types';
import type { ASTNode, BinaryExpression, ComparisonExpression, FunctionCall, NotExpression } from '../types/query-language.types';
import type { FieldIndexer } from './field-indexer';
import { getNormalizedEnvironment, getNormalizedLevel } from './search-utils';

export interface EvaluationContext {
  entries: ParsedLogEntry[];
  indexer?: FieldIndexer;
}

export interface EvaluationResult {
  matchedIndices: number[];
  usedIndexes: boolean;
  evaluationTimeMs: number;
}

export function evaluateQuery(ast: ASTNode, context: EvaluationContext): EvaluationResult {
  const startTime = performance.now();
  const matchedIndices = evaluateNode(ast, context);
  const evaluationTimeMs = performance.now() - startTime;

  return {
    matchedIndices,
    usedIndexes: context.indexer !== undefined,
    evaluationTimeMs,
  };
}

function evaluateNode(node: ASTNode, context: EvaluationContext): number[] {
  switch (node.type) {
    case 'BinaryExpression':
      return evaluateBinaryExpression(node, context);
    case 'ComparisonExpression':
      return evaluateComparisonExpression(node, context);
    case 'FunctionCall':
      return evaluateFunctionCall(node, context);
    case 'NotExpression':
      return evaluateNotExpression(node, context);
    default:
      return [];
  }
}

function evaluateBinaryExpression(node: BinaryExpression, context: EvaluationContext): number[] {
  const leftIndices = evaluateNode(node.left, context);
  const rightIndices = evaluateNode(node.right, context);

  if (node.operator === 'AND') {
    const leftSet = new Set(leftIndices);
    return rightIndices.filter((idx) => leftSet.has(idx));
  } else {
    const resultSet = new Set([...leftIndices, ...rightIndices]);
    return Array.from(resultSet).sort((a, b) => a - b);
  }
}

function evaluateComparisonExpression(node: ComparisonExpression, context: EvaluationContext): number[] {
  const fieldName = node.field.name;
  const operator = node.operator;
  const targetValue = node.value.value;

  // Try to use indexes for common fields
  if (context.indexer && operator === '=') {
    if (fieldName === 'level') {
      return context.indexer.queryByLevel(String(targetValue));
    }
    if (fieldName === 'environment') {
      return context.indexer.queryByEnvironment(String(targetValue));
    }
  }

  // Handle timestamp range queries with index
  if (context.indexer && fieldName === 'timestamp' && node.value.valueType === 'string') {
    const timestamp = Date.parse(String(targetValue));
    if (!isNaN(timestamp)) {
      switch (operator) {
        case '>':
          return context.indexer.queryTimestampRange(timestamp + 1, null);
        case '>=':
          return context.indexer.queryTimestampRange(timestamp, null);
        case '<':
          return context.indexer.queryTimestampRange(null, timestamp - 1);
        case '<=':
          return context.indexer.queryTimestampRange(null, timestamp);
        case '=': {
          // Exact timestamp match (rare but supported)
          const indices = context.indexer.queryTimestampRange(timestamp, timestamp);
          return indices;
        }
      }
    }
  }

  // Fall back to full scan
  const results: number[] = [];

  context.entries.forEach((entry, index) => {
    const fieldValue = extractFieldValue(entry, fieldName);
    if (fieldValue !== null && compareValues(fieldValue, operator, targetValue)) {
      results.push(index);
    }
  });

  return results;
}

function evaluateFunctionCall(node: FunctionCall, context: EvaluationContext): number[] {
  const fieldName = node.field.name;
  const functionName = node.function;
  const argument = node.argument;

  const results: number[] = [];

  if (
    context.indexer &&
    functionName === 'contains' &&
    argument.type === 'Literal' &&
    typeof argument.value === 'string' &&
    fieldName === 'message'
  ) {
    const keyword = String(argument.value).toLowerCase();
    const keywordIndices = context.indexer.queryByKeyword(keyword);

    // Verify matches (keyword index may have false positives)
    keywordIndices.forEach((index) => {
      const entry = context.entries[index];
      const fieldValue = extractFieldValue(entry, fieldName);
      if (fieldValue && applyFunction(String(fieldValue), functionName, argument)) {
        results.push(index);
      }
    });

    return results;
  }

  // Full scan
  context.entries.forEach((entry, index) => {
    const fieldValue = extractFieldValue(entry, fieldName);
    if (fieldValue !== null && applyFunction(String(fieldValue), functionName, argument)) {
      results.push(index);
    }
  });

  return results;
}

function evaluateNotExpression(node: NotExpression, context: EvaluationContext): number[] {
  const matchedIndices = evaluateNode(node.expression, context);
  const matchedSet = new Set(matchedIndices);

  const results: number[] = [];
  for (let i = 0; i < context.entries.length; i++) {
    if (!matchedSet.has(i)) {
      results.push(i);
    }
  }

  return results;
}

function extractFieldValue(entry: ParsedLogEntry, fieldName: string): string | number | boolean | null {
  try {
    switch (fieldName) {
      case 'level':
        return getNormalizedLevel(entry);
      case 'environment':
        return getNormalizedEnvironment(entry);
      case 'kind':
        return entry.kind;
      case 'message':
        return extractMessage(entry);
      case 'timestamp':
        return extractTimestamp(entry);

      // Pino specific
      case 'msg':
        if (entry.kind === 'pino') return entry.entry.msg;
        return null;
      case 'hostname':
        if (entry.kind === 'pino') return entry.entry.hostname;
        return null;
      case 'pid':
        if (entry.kind === 'pino') return entry.entry.pid;
        return null;
      case 'name':
        if (entry.kind === 'pino') return entry.entry.name;
        return null;
      case 'time':
        if (entry.kind === 'pino') return entry.entry.time;
        return null;

      // Winston specific
      case 'requestId':
        if (entry.kind === 'winston') return (entry.entry.meta as any)?.requestId || null;
        return null;
      case 'userId':
        if (entry.kind === 'winston') return (entry.entry.meta as any)?.userId || null;
        return null;
      case 'traceId':
        if (entry.kind === 'winston') return (entry.entry.meta as any)?.traceId || null;
        return null;

      // Loki specific
      case 'line':
        if (entry.kind === 'loki') return (entry.entry as any).line;
        return null;
      case 'job':
        if (entry.kind === 'loki') return (entry.entry as any).labels?.job || null;
        return null;
      case 'instance':
        if (entry.kind === 'loki') return (entry.entry as any).labels?.instance || null;
        return null;
      case 'app':
        if (entry.kind === 'loki') return (entry.entry as any).labels?.app || null;
        return null;

      // Docker specific
      case 'log':
        if (entry.kind === 'docker') return (entry.entry as any).log;
        return null;
      case 'stream':
        if (entry.kind === 'docker') return (entry.entry as any).stream;
        return null;

      // HTTP fields (when available in pino)
      case 'statusCode':
        if (entry.kind === 'pino' && (entry.entry as any).res) {
          return (entry.entry as any).res.statusCode;
        }
        return null;
      case 'method':
        if (entry.kind === 'pino' && (entry.entry as any).req) {
          return (entry.entry as any).req.method;
        }
        return null;
      case 'url':
        if (entry.kind === 'pino' && (entry.entry as any).req) {
          return (entry.entry as any).req.url;
        }
        return null;
      case 'responseTime':
        if (entry.kind === 'pino' && (entry.entry as any).res) {
          return (entry.entry as any).res.responseTimeMs;
        }
        return null;

      default:
        // Try to extract from generic entry object
        const anyEntry = entry.entry as any;
        return anyEntry?.[fieldName] ?? null;
    }
  } catch {
    return null;
  }
}

function extractMessage(entry: ParsedLogEntry): string | null {
  try {
    switch (entry.kind) {
      case 'pino':
        return entry.entry.msg || null;
      case 'winston':
        return entry.entry.message || null;
      case 'loki':
        return (entry.entry as any).line || null;
      case 'promtail':
        return (entry.entry as any).message || null;
      case 'docker':
        return (entry.entry as any).log || null;
      case 'text':
        return (entry.entry as any).line || null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function extractTimestamp(entry: ParsedLogEntry): number | null {
  try {
    switch (entry.kind) {
      case 'pino':
        return typeof entry.entry.time === 'number' ? entry.entry.time : null;
      case 'winston':
        return Date.parse(entry.entry.timestamp);
      case 'loki':
      case 'promtail':
        return Date.parse((entry.entry as any).ts);
      case 'docker':
        return Date.parse((entry.entry as any).time);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function compareValues(
  fieldValue: string | number | boolean,
  operator: string,
  targetValue: string | number | boolean,
): boolean {
  // Type coercion for comparison
  const fieldStr = String(fieldValue);
  const targetStr = String(targetValue);

  switch (operator) {
    case '=':
      return fieldStr === targetStr;
    case '!=':
      return fieldStr !== targetStr;
    case '>':
      // Try numeric comparison first
      if (typeof fieldValue === 'number' && typeof targetValue === 'number') {
        return fieldValue > targetValue;
      }
      return fieldStr > targetStr;
    case '<':
      if (typeof fieldValue === 'number' && typeof targetValue === 'number') {
        return fieldValue < targetValue;
      }
      return fieldStr < targetStr;
    case '>=':
      if (typeof fieldValue === 'number' && typeof targetValue === 'number') {
        return fieldValue >= targetValue;
      }
      return fieldStr >= targetStr;
    case '<=':
      if (typeof fieldValue === 'number' && typeof targetValue === 'number') {
        return fieldValue <= targetValue;
      }
      return fieldStr <= targetStr;
    default:
      return false;
  }
}

function applyFunction(
  fieldValue: string,
  functionName: string,
  argument: { type: string; value?: string | number | boolean; pattern?: string; flags?: string },
): boolean {
  const fieldLower = fieldValue.toLowerCase();

  switch (functionName) {
    case 'contains': {
      const searchStr = String(argument.value || '').toLowerCase();
      return fieldLower.includes(searchStr);
    }
    case 'startsWith': {
      const searchStr = String(argument.value || '').toLowerCase();
      return fieldLower.startsWith(searchStr);
    }
    case 'endsWith': {
      const searchStr = String(argument.value || '').toLowerCase();
      return fieldLower.endsWith(searchStr);
    }
    case 'matches': {
      if (argument.type === 'RegexPattern' && argument.pattern) {
        try {
          const regex = new RegExp(argument.pattern, argument.flags || '');
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      }
      // Fallback to string literal as regex pattern
      if (argument.value) {
        try {
          const regex = new RegExp(String(argument.value));
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      }
      return false;
    }
    default:
      return false;
  }
}
