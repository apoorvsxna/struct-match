import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import { ASTNode } from '../types';
import crypto from 'crypto';

/**
 * LRU cache used internally by the Parser to store and retrieve previously parsed ASTs.
 */
class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, T>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: string): T | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move to the end to mark it as most recently used
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.capacity && !this.cache.has(key)) {
      // Evict the least recently used item
      const firstKey = this.cache.keys().next().value!;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

/**
 * Parses source code to AST (or gets AST from cache, if available)
 */
export class CodeParser {
  private parser: Parser;
  private astCache: LRUCache<Parser.Tree>;

  /**
   * Initializes the parser and sets the language to JavaScript.
   * @param cacheSize The number of ASTs to keep in the LRU cache.
   */
  constructor(cacheSize = 50) {
    this.parser = new Parser();
    this.parser.setLanguage(JavaScript);
    this.astCache = new LRUCache(cacheSize);
  }

  /**
   * Parses the given source code into a tree-sitter Tree.
   * Uses SHA-256 for caching.
   *
   * @param sourceCode The source code string to parse.
   * @returns The parsed tree-sitter Tree.
   */
  public parse(sourceCode: string): Parser.Tree {
    const hash = crypto.createHash('sha256');
    hash.update(sourceCode);
    const cacheKey = hash.digest('hex');

    const cachedTree = this.astCache.get(cacheKey);
    if (cachedTree) {
      return cachedTree;
    }

    const tree = this.parser.parse(sourceCode);
    this.astCache.set(cacheKey, tree);

    return tree;
  }

  /**
   * Retrieves all nodes of a specific type from the given AST.
   * This is an efficient way to find potential match candidates.
   *
   * @param tree The AST to search within.
   * @param nodeType The type of node to find (for example, 'call_expression').
   * @returns An array of ASTNodes of the specified type.
   */
  public getNodesOfType(tree: Parser.Tree, nodeType: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const stack: ASTNode[] = [tree.rootNode];

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.type === nodeType) {
        nodes.push(node);
      }

      // Traverse children in reverse to maintain document order if needed later
      for (let i = node.childCount - 1; i >= 0; i--) {
        const child = node.child(i);
        if (child) {
          stack.push(child);
        }
      }
    }
    return nodes;
  }
}