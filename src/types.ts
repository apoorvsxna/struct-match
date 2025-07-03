import { SyntaxNode } from 'tree-sitter';

/** An alias for a tree-sitter `SyntaxNode`. */
export interface ASTNode extends SyntaxNode {}

/** A map of captured metavariable names to their string values. */
export interface Metavariable {
  [key: string]: string;
}

/** A single match result from a search query. */
export interface Match {
  /** The id of the rule that produced this match. */
  ruleId: string;
  /** The AST node that matched. */
  node: ASTNode;
  /** The text content of the matched node. */
  matchedText: string;
  startLine: number;
  endLine: number;
  /** Captured metavariables (e.g., `{ "$NAME": "user" }`). */
  metavariables: Metavariable;
}

/**
 * A declarative rule for querying the AST.
 * Rules can be nested to specify context.
 */
export interface RulePattern {
  /** The core tree-sitter pattern string. */
  pattern?: string;
  /** Matches any of the provided patterns. */
  any?: RulePattern[];
  /** Narrows the search to descendants of a node matching this pattern. */
  inside?: RulePattern;
  /** Requires the matched node to contain a node matching this pattern. */
  contains?: RulePattern;
  /** Requires a preceding sibling to match this pattern. */
  precedes?: RulePattern;
  /** Requires a following sibling to match this pattern. */
  follows?: RulePattern;
  /** Inverts the match; excludes nodes that match this pattern. */
  not?: RulePattern;
}