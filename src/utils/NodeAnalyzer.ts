import { ASTNode } from '../types';

/**
 * Gets the starting and ending line numbers for a given AST node
 * in the source code.
 *
 * @param sourceCode Full source code string.
 * @param node The node for which to calculate line numbers.
 * @returns An object containing the start and end line numbers.
 */
export function getLineNumbers(
  sourceCode: string,
  node: ASTNode
): { startLine: number; endLine: number } {
  const upToStart = sourceCode.slice(0, node.startIndex);
  const upToEnd = sourceCode.slice(0, node.endIndex);

  const startLine = (upToStart.match(/\n/g) || []).length + 1;
  const endLine = (upToEnd.match(/\n/g) || []).length + 1;

  return { startLine, endLine };
}

/**
 * Retrieves the text content of a given matched node.
 *
 * @param node The node from which to extract text.
 * @returns The text content of the node.
 */
export function getMatchText(node: ASTNode): string {
  return node.text;
}