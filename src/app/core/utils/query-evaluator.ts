import type { ParsedLogEntry } from '../types/file-parse.types';
import type {
  ASTNode,
  BinaryExpression,
  ComparisonExpression,
  FunctionCall,
  NotExpression,
} from '../types/query-language.types';
import { extractFieldValue as extractField } from './field-extractor';
import type { FieldIndexer } from './field-indexer';

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
  const fieldName = node.field.name; // This may now be dot notation
  const operator = node.operator;
  const targetValue = node.value.value;

  // Debug: log comparison intent
  try {
    console.debug(`[QueryEval] Comparing field '${fieldName}' ${operator} '${String(targetValue)}'`);
  } catch {
    /* ignore logging errors */
  }

  // Try to use indexes for common fields (only for flat fields)
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
          return context.indexer.queryTimestampRange(timestamp, timestamp);
        }
      }
    }
  }

  // Full scan, now supports dot notation for nested fields
  const results: number[] = [];
  context.entries.forEach((entry, index) => {
    const fieldValue = extractField(entry, fieldName); // fieldName may be dot notation

    // Debug log per-entry when in dev to trace failures
    if (fieldValue === null) {
      try {
        console.debug(`[QueryEval][Idx ${index}] field '${fieldName}' -> null`);
      } catch {
        /* ignore logging errors */
      }
    } else {
      try {
        console.debug(`[QueryEval][Idx ${index}] field '${fieldName}' -> (${typeof fieldValue}) ${String(fieldValue)}`);
      } catch {
        /* ignore logging errors */
      }
    }

    if (fieldValue !== null && compareValues(fieldValue, operator, targetValue)) {
      try {
        console.debug(`[QueryEval][Idx ${index}] MATCHED`);
      } catch {
        /* ignore logging errors */
      }
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
      const fieldValue = extractField(entry, fieldName);
      if (fieldValue && applyFunction(String(fieldValue), functionName, argument)) {
        results.push(index);
      }
    });

    return results;
  }

  // Full scan
  context.entries.forEach((entry, index) => {
    const fieldValue = extractField(entry, fieldName);
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

function compareValues(
  fieldValue: string | number | boolean,
  operator: string,
  targetValue: string | number | boolean,
): boolean {
  // If both values are numbers (or can be parsed as numbers), compare as numbers
  const fieldNum =
    typeof fieldValue === 'number'
      ? fieldValue
      : typeof fieldValue === 'string' && !isNaN(Number(fieldValue))
        ? Number(fieldValue)
        : null;
  const targetNum =
    typeof targetValue === 'number'
      ? targetValue
      : typeof targetValue === 'string' && !isNaN(Number(targetValue))
        ? Number(targetValue)
        : null;
  if (fieldNum !== null && targetNum !== null) {
    switch (operator) {
      case '=':
        return fieldNum === targetNum;
      case '!=':
        return fieldNum !== targetNum;
      case '>':
        return fieldNum > targetNum;
      case '<':
        return fieldNum < targetNum;
      case '>=':
        return fieldNum >= targetNum;
      case '<=':
        return fieldNum <= targetNum;
    }
  }
  // Fallback: string comparison for non-numeric values
  if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
    const fieldStr = fieldValue.toLowerCase();
    const targetStr = targetValue.toLowerCase();
    switch (operator) {
      case '=':
        return fieldStr === targetStr;
      case '!=':
        return fieldStr !== targetStr;
      case '>':
        return fieldStr > targetStr;
      case '<':
        return fieldStr < targetStr;
      case '>=':
        return fieldStr >= targetStr;
      case '<=':
        return fieldStr <= targetStr;
    }
  } else {
    const fieldStr = String(fieldValue);
    const targetStr = String(targetValue);
    switch (operator) {
      case '=':
        return fieldStr === targetStr;
      case '!=':
        return fieldStr !== targetStr;
      case '>':
        return fieldStr > targetStr;
      case '<':
        return fieldStr < targetStr;
      case '>=':
        return fieldStr >= targetStr;
      case '<=':
        return fieldStr <= targetStr;
    }
  }
  return false;
}

function applyFunction(
  fieldValue: string,
  functionName: string,
  argument: { type: string; value?: string | number | boolean; pattern?: string; flags?: string },
): boolean {
  const fieldLower = fieldValue.toLowerCase();

  switch (functionName) {
    case 'contains': {
      // Support both literal string and regex patterns for contains().
      if (argument.type === 'RegexPattern' && argument.pattern) {
        try {
          const regex = new RegExp(argument.pattern, argument.flags || '');
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      }

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
          /* ignore regex errors */
          return false;
        }
      }
      // Fallback to string literal as regex pattern
      if (argument.value) {
        try {
          const regex = new RegExp(String(argument.value));
          return regex.test(fieldValue);
        } catch {
          /* ignore regex errors */
          return false;
        }
      }
      return false;
    }
    default:
      return false;
  }
}
