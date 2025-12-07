import type {
  ASTNode,
  BinaryExpression,
  BinaryOperator,
  ComparisonExpression,
  ComparisonOperator,
  FunctionOperator,
  Literal,
  NotExpression,
  ParsedQuery,
  QueryValidationError,
  RegexPattern,
} from '../types/query-language.types';
import { FIELD_ALIASES } from '../types/query-language.types';

enum TokenType {
  // Literals
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  REGEX = 'REGEX',
  IDENTIFIER = 'IDENTIFIER',

  // Operators
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_THAN_EQUALS = 'GREATER_THAN_EQUALS',
  LESS_THAN_EQUALS = 'LESS_THAN_EQUALS',

  // Delimiters
  LEFT_PAREN = 'LEFT_PAREN',
  RIGHT_PAREN = 'RIGHT_PAREN',
  DOT = 'DOT',
  COMMA = 'COMMA',

  // Special
  EOF = 'EOF',
}

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

class Lexer {
  private input: string;
  private position = 0;
  private current: string | null = null;

  constructor(input: string) {
    this.input = input;
    this.current = input.length > 0 ? input[0] : null;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.current !== null) {
      this.skipWhitespace();

      if (this.current === null) break;

      const startPos = this.position;

      // String literals
      if (this.current === '"' || this.current === "'") {
        const quote = this.current;
        const value = this.readString(quote);
        tokens.push({ type: TokenType.STRING, value, position: startPos });
        continue;
      }

      // Regex literals
      if (this.current === '/') {
        const { pattern, flags } = this.readRegex();
        tokens.push({ type: TokenType.REGEX, value: `/${pattern}/${flags}`, position: startPos });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(this.current)) {
        const value = this.readNumber();
        tokens.push({ type: TokenType.NUMBER, value, position: startPos });
        continue;
      }

      // Operators and delimiters
      if (this.current === '=' && this.peek() !== '=') {
        tokens.push({ type: TokenType.EQUALS, value: '=', position: startPos });
        this.advance();
        continue;
      }

      if (this.current === '!' && this.peek() === '=') {
        tokens.push({ type: TokenType.NOT_EQUALS, value: '!=', position: startPos });
        this.advance();
        this.advance();
        continue;
      }

      if (this.current === '>' && this.peek() === '=') {
        tokens.push({ type: TokenType.GREATER_THAN_EQUALS, value: '>=', position: startPos });
        this.advance();
        this.advance();
        continue;
      }

      if (this.current === '>' && this.peek() !== '=') {
        tokens.push({ type: TokenType.GREATER_THAN, value: '>', position: startPos });
        this.advance();
        continue;
      }

      if (this.current === '<' && this.peek() === '=') {
        tokens.push({ type: TokenType.LESS_THAN_EQUALS, value: '<=', position: startPos });
        this.advance();
        this.advance();
        continue;
      }

      if (this.current === '<' && this.peek() !== '=') {
        tokens.push({ type: TokenType.LESS_THAN, value: '<', position: startPos });
        this.advance();
        continue;
      }

      if (this.current === '(') {
        tokens.push({ type: TokenType.LEFT_PAREN, value: '(', position: startPos });
        this.advance();
        continue;
      }

      if (this.current === ')') {
        tokens.push({ type: TokenType.RIGHT_PAREN, value: ')', position: startPos });
        this.advance();
        continue;
      }

      if (this.current === '.') {
        tokens.push({ type: TokenType.DOT, value: '.', position: startPos });
        this.advance();
        continue;
      }

      if (this.current === ',') {
        tokens.push({ type: TokenType.COMMA, value: ',', position: startPos });
        this.advance();
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(this.current)) {
        const value = this.readIdentifier();
        const upper = value.toUpperCase();

        if (upper === 'AND') {
          tokens.push({ type: TokenType.AND, value: upper, position: startPos });
        } else if (upper === 'OR') {
          tokens.push({ type: TokenType.OR, value: upper, position: startPos });
        } else if (upper === 'NOT') {
          tokens.push({ type: TokenType.NOT, value: upper, position: startPos });
        } else {
          tokens.push({ type: TokenType.IDENTIFIER, value, position: startPos });
        }
        continue;
      }

      // Unknown character - skip it
      this.advance();
    }

    tokens.push({ type: TokenType.EOF, value: '', position: this.position });
    return tokens;
  }

  private advance(): void {
    this.position++;
    this.current = this.position < this.input.length ? this.input[this.position] : null;
  }

  private peek(offset = 1): string | null {
    const pos = this.position + offset;
    return pos < this.input.length ? this.input[pos] : null;
  }

  private skipWhitespace(): void {
    while (this.current !== null && /\s/.test(this.current)) {
      this.advance();
    }
  }

  private readString(quote: string): string {
    let result = '';
    this.advance(); // skip opening quote

    while (this.current !== null && this.current !== quote) {
      if (this.current === '\\' && this.peek() === quote) {
        this.advance(); // skip backslash
        result += this.current;
        this.advance();
      } else {
        result += this.current;
        this.advance();
      }
    }

    if (this.current === quote) {
      this.advance(); // skip closing quote
    }

    return result;
  }

  private readNumber(): string {
    let result = '';
    while (this.current !== null && /[0-9.]/.test(this.current)) {
      result += this.current;
      this.advance();
    }
    return result;
  }

  private readIdentifier(): string {
    let result = '';
    while (this.current !== null && /[a-zA-Z0-9_-]/.test(this.current)) {
      result += this.current;
      this.advance();
    }
    return result;
  }

  private readRegex(): { pattern: string; flags: string } {
    let pattern = '';
    this.advance(); // skip opening /

    while (this.current !== null && this.current !== '/') {
      if (this.current === '\\' && this.peek() === '/') {
        pattern += this.current;
        this.advance();
        pattern += this.current;
        this.advance();
      } else {
        pattern += this.current;
        this.advance();
      }
    }

    if (this.current === '/') {
      this.advance(); // skip closing /
    }

    // Read flags
    let flags = '';
    while (this.current !== null && /[gimsuvy]/.test(this.current)) {
      flags += this.current;
      this.advance();
    }

    return { pattern, flags };
  }
}

class Parser {
  private tokens: Token[];
  private position = 0;
  private errors: QueryValidationError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): { ast: ASTNode | null; errors: QueryValidationError[] } {
    this.errors = [];
    const ast = this.parseExpression();
    return { ast, errors: this.errors };
  }

  private current(): Token {
    return this.tokens[this.position];
  }

  private peek(offset = 1): Token {
    const pos = this.position + offset;
    return pos < this.tokens.length ? this.tokens[pos] : this.tokens[this.tokens.length - 1];
  }

  private advance(): void {
    if (this.position < this.tokens.length - 1) {
      this.position++;
    }
  }

  private expect(type: TokenType): Token | null {
    if (this.current().type === type) {
      const token = this.current();
      this.advance();
      return token;
    }
    this.errors.push({
      message: `Expected ${type} but got ${this.current().type}`,
      position: this.current().position,
      token: this.current().value,
    });
    return null;
  }

  private parseExpression(): ASTNode | null {
    return this.parseOrExpression();
  }

  private parseOrExpression(): ASTNode | null {
    let left = this.parseAndExpression();
    if (!left) return null;

    while (this.current().type === TokenType.OR) {
      this.advance();
      const right = this.parseAndExpression();
      if (!right) return null;

      left = {
        type: 'BinaryExpression',
        operator: 'OR' as BinaryOperator,
        left,
        right,
      } as BinaryExpression;
    }

    return left;
  }

  private parseAndExpression(): ASTNode | null {
    let left = this.parseNotExpression();
    if (!left) return null;

    while (this.current().type === TokenType.AND) {
      this.advance();
      const right = this.parseNotExpression();
      if (!right) return null;

      left = {
        type: 'BinaryExpression',
        operator: 'AND' as BinaryOperator,
        left,
        right,
      } as BinaryExpression;
    }

    return left;
  }

  private parseNotExpression(): ASTNode | null {
    if (this.current().type === TokenType.NOT) {
      this.advance();
      const expression = this.parseNotExpression();
      if (!expression) return null;

      return {
        type: 'NotExpression',
        expression,
      } as NotExpression;
    }

    return this.parsePrimaryExpression();
  }

  private parsePrimaryExpression(): ASTNode | null {
    // Parenthesized expression
    if (this.current().type === TokenType.LEFT_PAREN) {
      this.advance();
      const expression = this.parseExpression();
      this.expect(TokenType.RIGHT_PAREN);
      return expression;
    }

    // Top-level function call: contains(message, "db")
    if (this.current().type === TokenType.IDENTIFIER && this.peek().type === TokenType.LEFT_PAREN) {
      const funcToken = this.current();
      this.advance(); // function name
      this.expect(TokenType.LEFT_PAREN);
      // Parse first argument (field)
      let fieldName = '';
      if (this.current().type === TokenType.IDENTIFIER) {
        fieldName = this.current().value;
        this.advance();
        // Support dot notation in field argument
        while (this.current().type === TokenType.DOT && this.peek().type === TokenType.IDENTIFIER) {
          this.advance();
          fieldName += '.' + this.current().value;
          this.advance();
        }
      } else {
        this.errors.push({
          message: `Expected field name as first argument to function ${funcToken.value}`,
          position: this.current().position,
          token: this.current().value,
        });
        return null;
      }
      // Expect comma
      if (this.current().type !== TokenType.COMMA) {
        if (this.current().type === TokenType.RIGHT_PAREN) {
          this.errors.push({
            message: `Function ${funcToken.value} expects two arguments`,
            position: this.current().position,
            token: this.current().value,
          });
          this.advance();
          return null;
        }
        this.errors.push({
          message: `Expected comma after field argument in function ${funcToken.value}`,
          position: this.current().position,
          token: this.current().value,
        });
        return null;
      }
      this.advance(); // skip comma
      // Parse second argument (literal or regex)
      const arg = this.parseArgument();
      this.expect(TokenType.RIGHT_PAREN);
      if (!arg) return null;
      return {
        type: 'FunctionCall',
        function: funcToken.value.toLowerCase() as FunctionOperator,
        field: { type: 'FieldReference', name: this.normalizeFieldName(fieldName) },
        argument: arg,
      };
    }

    // Field reference (for comparison or function call)
    if (this.current().type === TokenType.IDENTIFIER) {
      // Support dot notation for nested fields
      let fieldName = this.current().value;
      this.advance();
      while (this.current().type === TokenType.DOT && this.peek().type === TokenType.IDENTIFIER) {
        this.advance(); // skip DOT
        fieldName += '.' + this.current().value;
        this.advance();
      }

      // Function call: field.function(arg)
      if (this.current().type === TokenType.DOT && this.peek().type === TokenType.IDENTIFIER) {
        // This is ambiguous with dot notation, so only allow function call if not part of field path
        // (e.g., field.function(...)), not field.nested.function(...)
        // For now, only support function call on top-level field
        // If needed, enhance to support nested fields with functions
      }

      // Comparison: field op value
      const compOp = this.parseComparisonOperator();
      if (!compOp) {
        this.errors.push({
          message: `Expected comparison operator after field ${fieldName}`,
          position: this.current().position,
        });
        return null;
      }

      const value = this.parseLiteral();
      if (!value) return null;

      return {
        type: 'ComparisonExpression',
        operator: compOp,
        field: { type: 'FieldReference', name: this.normalizeFieldName(fieldName) },
        value,
      } as ComparisonExpression;
    }

    this.errors.push({
      message: `Unexpected token: ${this.current().value}`,
      position: this.current().position,
      token: this.current().value,
    });
    return null;
  }

  private parseComparisonOperator(): ComparisonOperator | null {
    const token = this.current();
    let operator: ComparisonOperator | null = null;

    switch (token.type) {
      case TokenType.EQUALS:
        operator = '=' as ComparisonOperator;
        break;
      case TokenType.NOT_EQUALS:
        operator = '!=' as ComparisonOperator;
        break;
      case TokenType.GREATER_THAN:
        operator = '>' as ComparisonOperator;
        break;
      case TokenType.LESS_THAN:
        operator = '<' as ComparisonOperator;
        break;
      case TokenType.GREATER_THAN_EQUALS:
        operator = '>=' as ComparisonOperator;
        break;
      case TokenType.LESS_THAN_EQUALS:
        operator = '<=' as ComparisonOperator;
        break;
    }

    if (operator) {
      this.advance();
    }

    return operator;
  }

  private parseLiteral(): Literal | null {
    const token = this.current();

    if (token.type === TokenType.STRING) {
      this.advance();
      return {
        type: 'Literal',
        value: token.value,
        valueType: 'string',
      };
    }

    if (token.type === TokenType.NUMBER) {
      this.advance();
      return {
        type: 'Literal',
        value: parseFloat(token.value),
        valueType: 'number',
      };
    }

    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      // Try to parse as boolean
      const lower = token.value.toLowerCase();
      if (lower === 'true' || lower === 'false') {
        return {
          type: 'Literal',
          value: lower === 'true',
          valueType: 'boolean',
        };
      }
      // Otherwise treat as unquoted string
      return {
        type: 'Literal',
        value: token.value,
        valueType: 'string',
      };
    }

    this.errors.push({
      message: `Expected literal value`,
      position: token.position,
      token: token.value,
    });
    return null;
  }

  private parseArgument(): Literal | RegexPattern | null {
    const token = this.current();

    if (token.type === TokenType.REGEX) {
      this.advance();
      const match = token.value.match(/^\/(.*)\/([gimsuvy]*)$/);
      if (match) {
        return {
          type: 'RegexPattern',
          pattern: match[1],
          flags: match[2] || undefined,
        };
      }
      this.errors.push({
        message: `Invalid regex pattern`,
        position: token.position,
        token: token.value,
      });
      return null;
    }

    return this.parseLiteral();
  }

  private normalizeFieldName(name: string): string {
    return FIELD_ALIASES[name] || name;
  }
}

/**
 * Parse a query string into an AST
 */
export function parseQuery(query: string): ParsedQuery {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      ast: null,
      isLegacyTextSearch: false,
      originalQuery: query,
      errors: [],
    };
  }

  // Detect if this looks like a structured query
  const hasStructuredSyntax =
    /[=<>!]/.test(trimmed) ||
    /\b(AND|OR|NOT)\b/i.test(trimmed) ||
    /\.\s*(contains|startsWith|endsWith|matches)\s*\(/i.test(trimmed) ||
    /\b(contains|startsWith|endsWith|matches)\s*\(/i.test(trimmed);

  if (!hasStructuredSyntax) {
    // Fall back to legacy text search
    return {
      ast: null,
      isLegacyTextSearch: true,
      originalQuery: query,
      errors: [],
    };
  }

  // Parse as structured query
  const lexer = new Lexer(trimmed);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { ast, errors } = parser.parse();

  return {
    ast,
    isLegacyTextSearch: false,
    originalQuery: query,
    errors,
  };
}

/**
 * Validate a query without fully parsing it
 */
export function validateQuery(query: string): { valid: boolean; errors: QueryValidationError[] } {
  const result = parseQuery(query);

  if (result.isLegacyTextSearch) {
    return { valid: true, errors: [] };
  }

  const valid = result.errors.length === 0 && result.ast !== null;
  return { valid, errors: result.errors };
}
