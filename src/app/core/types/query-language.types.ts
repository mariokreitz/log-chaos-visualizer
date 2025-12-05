// Operator enums
export enum BinaryOperator {
  AND = 'AND',
  OR = 'OR',
}

export enum ComparisonOperator {
  EQUALS = '=',
  NOT_EQUALS = '!=',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  GREATER_THAN_EQUALS = '>=',
  LESS_THAN_EQUALS = '<=',
}

export enum FunctionOperator {
  CONTAINS = 'contains',
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
  MATCHES = 'matches',
}

// AST Node types
export type ASTNode =
  | BinaryExpression
  | ComparisonExpression
  | FunctionCall
  | NotExpression
  | FieldReference
  | Literal
  | RegexPattern;

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: BinaryOperator;
  left: ASTNode;
  right: ASTNode;
}

export interface ComparisonExpression {
  type: 'ComparisonExpression';
  operator: ComparisonOperator;
  field: FieldReference;
  value: Literal;
}

export interface FunctionCall {
  type: 'FunctionCall';
  function: FunctionOperator;
  field: FieldReference;
  argument: Literal | RegexPattern;
}

export interface NotExpression {
  type: 'NotExpression';
  expression: ASTNode;
}

export interface FieldReference {
  type: 'FieldReference';
  name: string;
}

export interface Literal {
  type: 'Literal';
  value: string | number | boolean;
  valueType: 'string' | 'number' | 'boolean';
}

export interface RegexPattern {
  type: 'RegexPattern';
  pattern: string;
  flags?: string;
}

// Query validation types
export interface QueryValidationResult {
  valid: boolean;
  errors: QueryValidationError[];
  ast?: ASTNode;
}

export interface QueryValidationError {
  message: string;
  position?: number;
  token?: string;
}

// Parsed query result
export interface ParsedQuery {
  ast: ASTNode | null;
  isLegacyTextSearch: boolean;
  originalQuery: string;
  errors: QueryValidationError[];
}

// Supported field names by log format
export type SupportedField =
  // Common fields
  | 'level'
  | 'message'
  | 'timestamp'
  | 'environment'
  // Pino specific
  | 'msg'
  | 'time'
  | 'hostname'
  | 'pid'
  | 'name'
  // Winston specific
  | 'meta'
  | 'requestId'
  | 'userId'
  | 'traceId'
  // Loki specific
  | 'line'
  | 'labels'
  | 'job'
  | 'instance'
  | 'app'
  // Docker specific
  | 'log'
  | 'stream'
  // Promtail specific
  | 'ts'
  // HTTP fields (when available)
  | 'statusCode'
  | 'method'
  | 'url'
  | 'responseTime';

export const FIELD_ALIASES: Record<string, string> = {
  msg: 'message',
  line: 'message',
  log: 'message',
  time: 'timestamp',
  ts: 'timestamp',
};
