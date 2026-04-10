import * as ts from 'typescript';
import type { DeadBranch } from '../types.js';

/**
 * Find dead branches in a JS/TS file controlled by a dead flag.
 *
 * Parses the file into a TypeScript AST, finds all references to the flag
 * (both direct `process.env.FLAG` / `FLAG` reads and variable aliases like
 * `const x = process.env.FLAG; if (x) ...`), then walks upward from each
 * reference to find the enclosing `if` statement and identifies the dead branch.
 */
export function findDeadBranches(
  filePath: string,
  fileContent: string,
  flagName: string,
  flagAlwaysTrue: boolean,
): DeadBranch[] {
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
    );
  } catch {
    return [];
  }

  const aliases = collectAliases(sourceFile, flagName);
  const branches: DeadBranch[] = [];

  visitNode(sourceFile);
  return branches;

  function visitNode(node: ts.Node): void {
    if (ts.isIfStatement(node)) {
      const condResult = evaluateCondition(node.expression, flagName, aliases, flagAlwaysTrue);
      if (condResult !== null) {
        const dead = extractDeadBranch(sourceFile, filePath, node, condResult);
        if (dead) branches.push(dead);
      }
    }
    ts.forEachChild(node, visitNode);
  }
}

/**
 * Collect simple variable aliases for the flag.
 *
 * Matches patterns like:
 *   const useNew = process.env.ENABLE_X
 *   const useNew = ENABLE_X
 *   let useNew = process.env.ENABLE_X
 *
 * Does NOT trace through function calls, object destructuring, or reassignment.
 */
function collectAliases(
  sourceFile: ts.SourceFile,
  flagName: string,
): Set<string> {
  const aliases = new Set<string>();

  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isIdentifier(node.name)
    ) {
      if (isDirectFlagReference(node.initializer, flagName)) {
        aliases.add(node.name.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return aliases;
}

/**
 * Check if an expression is a direct reference to the flag:
 *   process.env.FLAG_NAME
 *   import.meta.env.FLAG_NAME
 *   FLAG_NAME (bare identifier, for const flags)
 */
function isDirectFlagReference(expr: ts.Expression, flagName: string): boolean {
  // process.env.FLAG_NAME or import.meta.env.FLAG_NAME
  if (ts.isPropertyAccessExpression(expr) && expr.name.text === flagName) {
    const obj = expr.expression;
    // process.env
    if (ts.isPropertyAccessExpression(obj) && obj.name.text === 'env') {
      return true;
    }
  }

  // Bare identifier: FLAG_NAME (for const flags)
  if (ts.isIdentifier(expr) && expr.text === flagName) {
    return true;
  }

  return false;
}

/**
 * Check if an expression is a reference to the flag or one of its aliases.
 */
function isFlagOrAlias(
  expr: ts.Expression,
  flagName: string,
  aliases: Set<string>,
): boolean {
  if (isDirectFlagReference(expr, flagName)) return true;
  if (ts.isIdentifier(expr) && aliases.has(expr.text)) return true;
  return false;
}

type ConditionTruth = 'always-true' | 'always-false';

/**
 * Evaluate a condition expression to determine its truth value,
 * given that the flag is always true or always false.
 *
 * Returns:
 *   'always-true'  → the condition always evaluates to true
 *   'always-false' → the condition always evaluates to false
 *   null           → can't determine (complex expression)
 */
function evaluateCondition(
  expr: ts.Expression,
  flagName: string,
  aliases: Set<string>,
  flagAlwaysTrue: boolean,
): ConditionTruth | null {
  // Strip parentheses
  while (ts.isParenthesizedExpression(expr)) {
    expr = expr.expression;
  }

  // Direct flag reference or alias: if (FLAG) or if (aliasVar)
  if (isFlagOrAlias(expr, flagName, aliases)) {
    return flagAlwaysTrue ? 'always-true' : 'always-false';
  }

  // Comparison: process.env.FLAG === "true" / !== "false" etc.
  if (ts.isBinaryExpression(expr)) {
    const { left, right, operatorToken } = expr;
    const op = operatorToken.kind;

    const isEq =
      op === ts.SyntaxKind.EqualsEqualsToken ||
      op === ts.SyntaxKind.EqualsEqualsEqualsToken;
    const isNeq =
      op === ts.SyntaxKind.ExclamationEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsEqualsToken;

    if (isEq || isNeq) {
      let flagSide: ts.Expression | null = null;
      let literalSide: ts.Expression | null = null;

      if (isFlagOrAlias(left, flagName, aliases)) {
        flagSide = left;
        literalSide = right;
      } else if (isFlagOrAlias(right, flagName, aliases)) {
        flagSide = right;
        literalSide = left;
      }

      if (flagSide && literalSide && ts.isStringLiteral(literalSide)) {
        const litValue = literalSide.text;
        const litIsTruthy = litValue === 'true' || litValue === '1' || litValue === 'yes';
        const matches = flagAlwaysTrue === litIsTruthy;
        if (isEq) return matches ? 'always-true' : 'always-false';
        if (isNeq) return matches ? 'always-false' : 'always-true';
      }
    }

    // Don't trace through && / || — too complex for v1
    return null;
  }

  // Negation: if (!FLAG)
  if (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const inner = evaluateCondition(expr.operand, flagName, aliases, flagAlwaysTrue);
    if (inner === 'always-true') return 'always-false';
    if (inner === 'always-false') return 'always-true';
    return null;
  }

  return null;
}

/**
 * Given an `if` statement whose condition is always-true or always-false,
 * extract the dead branch as a DeadBranch.
 */
function extractDeadBranch(
  sourceFile: ts.SourceFile,
  filePath: string,
  ifStmt: ts.IfStatement,
  condTruth: ConditionTruth,
): DeadBranch | null {
  if (condTruth === 'always-true') {
    // Flag always true → condition always true → else branch is dead
    if (!ifStmt.elseStatement) return null;

    // Use getStart() (skips leading trivia) for tight content bounds
    const start = sourceFile.getLineAndCharacterOfPosition(
      ifStmt.elseStatement.getStart(sourceFile),
    );
    const end = sourceFile.getLineAndCharacterOfPosition(ifStmt.elseStatement.end);
    const startLine = start.line + 1; // 1-indexed
    const endLine = end.line + 1;

    return {
      file: filePath,
      startLine,
      endLine,
      lineCount: endLine - startLine + 1,
      branchType: 'else',
    };
  }

  if (condTruth === 'always-false') {
    // Flag always false → condition always false → then branch is dead
    const thenStmt = ifStmt.thenStatement;
    const start = sourceFile.getLineAndCharacterOfPosition(
      thenStmt.getStart(sourceFile),
    );
    const end = sourceFile.getLineAndCharacterOfPosition(thenStmt.end);
    const startLine = start.line + 1;
    const endLine = end.line + 1;

    // Only classify as early-return for guard clauses (no else branch).
    // If there IS an else, it's a full if/else, so the then branch type is 'if'.
    const hasElse = !!ifStmt.elseStatement;
    const branchType = !hasElse && isEarlyReturn(thenStmt) ? 'early-return' : 'if';

    if (!hasElse) {
      // No else → entire if statement is dead (condition + body)
      const ifStart = sourceFile.getLineAndCharacterOfPosition(
        ifStmt.getStart(sourceFile),
      );
      const ifStartLine = ifStart.line + 1;
      return {
        file: filePath,
        startLine: ifStartLine,
        endLine,
        lineCount: endLine - ifStartLine + 1,
        branchType,
      };
    }

    return {
      file: filePath,
      startLine,
      endLine,
      lineCount: endLine - startLine + 1,
      branchType,
    };
  }

  return null;
}

function isEarlyReturn(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt)) return true;
  if (ts.isBlock(stmt)) {
    const stmts = stmt.statements;
    if (stmts.length === 0) return false;
    return stmts.every(
      (s) => ts.isReturnStatement(s) || ts.isExpressionStatement(s),
    );
  }
  return false;
}
