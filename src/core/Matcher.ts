import Parser from 'tree-sitter';
import { ASTNode, Metavariable, RulePattern } from '../types';
import { CodeParser } from './Parser';

/**
 * Finds pattern matches in AST using metavariables ($VAR) and wildcards ($$$).
 */
export class Matcher {
  private parser: CodeParser;
  private static WILDCARD_SYMBOL = '$$$';

  constructor(parser: CodeParser) {
    this.parser = parser;
  }

  /**
   * Finds all nodes matching the given pattern.
   */
  public find(
    sourceTree: Parser.Tree,
    pattern: RulePattern
  ): { node: ASTNode; metavariables: Metavariable }[] {
    if (!pattern.pattern) {
      return [];
    }

    const patternTree = this.parser.parse(pattern.pattern);
    const targetNode = this.getDeepestSingleChild(patternTree.rootNode);

    const candidateNodes = this.parser.getNodesOfType(sourceTree, targetNode.type);

    const matches: { node: ASTNode; metavariables: Metavariable }[] = [];
    for (const sourceNode of candidateNodes) {
      const result = this.equalsWithMetavars(sourceNode, targetNode);
      if (result.matches) {
        matches.push({ node: sourceNode, metavariables: result.metavariables });
      }
    }
    return matches;
  }

  /**
   * Recursively compares nodes, handling metavariables and wildcards.
   */
  private equalsWithMetavars(
    node1: ASTNode, // source node
    node2: ASTNode, // pattern node
    currentMetavars: Metavariable = {}
  ): { matches: boolean; metavariables: Metavariable } {
    if (!node1 || !node2) {
      return { matches: false, metavariables: currentMetavars };
    }

    // Skip semicolons as they're syntactic sugar
    if (this.isSemicolonNode(node1) || this.isSemicolonNode(node2)) {
      return {
        matches: true,
        metavariables: currentMetavars
      };
    }

    // Wildcard matches any single node
    if (this.isWildcard(node2)) {
      return {
        matches: true,
        metavariables: currentMetavars
      };
    }

    // Handle metavariable capture and consistency
    if (this.isMetavariable(node2)) {
      const metavarName = node2.text;
      const nodeText = this.getNodeText(node1);

      if (!currentMetavars[metavarName]) {
        return {
          matches: true,
          metavariables: { ...currentMetavars, [metavarName]: nodeText }
        };
      } else {
        return {
          matches: currentMetavars[metavarName] === nodeText,
          metavariables: currentMetavars
        };
      }
    }

    // Member expressions need special handling due to nested structure
    if (this.isMemberExpression(node2)) {
      if (!this.isMemberExpression(node1)) {
        return { matches: false, metavariables: currentMetavars };
      }
      return this.matchMemberExpression(node1, node2, currentMetavars);
    }

    // Normalize property_identifier to identifier for consistent comparison
    const type1 = node1.type === 'property_identifier' ? 'identifier' : node1.type;
    const type2 = node2.type === 'property_identifier' ? 'identifier' : node2.type;

    if (type1 !== type2) {
      return { matches: false, metavariables: currentMetavars };
    }

    // For leaves, compare text directly
    if (node1.childCount === 0) {
      return {
        matches: node1.text === node2.text,
        metavariables: currentMetavars
      };
    }

    return this.compareChildren(node1, node2, currentMetavars);
  }

  /**
   * Compares children, handling wildcards and skipping semicolons.
   */
  private compareChildren(
    node1: ASTNode,
    node2: ASTNode,
    currentMetavars: Metavariable
  ): { matches: boolean; metavariables: Metavariable } {
    let currentMetavariables = { ...currentMetavars };
    let sourceIndex = 0;
    let patternIndex = 0;

    while (patternIndex < node2.childCount) {
      // Skip semicolons in both trees
      while (patternIndex < node2.childCount) {
        const patternChild = node2.child(patternIndex);
        if (!patternChild || !this.isSemicolonNode(patternChild)) break;
        patternIndex++;
      }

      while (sourceIndex < node1.childCount) {
        const sourceChild = node1.child(sourceIndex);
        if (!sourceChild || !this.isSemicolonNode(sourceChild)) break;
        sourceIndex++;
      }

      if (patternIndex >= node2.childCount) break;

      const patternChild = node2.child(patternIndex);
      if (!patternChild) break;

      // Handle wildcard matching
      if (this.isWildcard(patternChild)) {
        const result = this.handleWildcardMatch(
          node1,
          node2,
          sourceIndex,
          patternIndex,
          currentMetavariables
        );
        if (result.matches) return result;
        return { matches: false, metavariables: currentMetavars };
      } else {
        if (sourceIndex >= node1.childCount) {
          return { matches: false, metavariables: currentMetavars };
        }

        const sourceChild = node1.child(sourceIndex);
        if (!sourceChild) {
          return { matches: false, metavariables: currentMetavars };
        }

        const childResult = this.equalsWithMetavars(
          sourceChild,
          patternChild,
          currentMetavariables
        );

        if (!childResult.matches) {
          return { matches: false, metavariables: currentMetavars };
        }

        currentMetavariables = childResult.metavariables;
        sourceIndex++;
        patternIndex++;
      }
    }

    // Skip trailing semicolons in source
    while (sourceIndex < node1.childCount) {
      const sourceChild = node1.child(sourceIndex);
      if (!sourceChild || !this.isSemicolonNode(sourceChild)) break;
      sourceIndex++;
    }

    return {
      matches: sourceIndex === node1.childCount,
      metavariables: currentMetavariables
    };
  }

  /**
   * Handles wildcard matching by consuming nodes until finding a match for the next pattern.
   */
  private handleWildcardMatch(
    node1: ASTNode,
    node2: ASTNode,
    sourceIndex: number,
    patternIndex: number,
    currentMetavars: Metavariable
  ): { matches: boolean; metavariables: Metavariable } {
    const remainingPattern = node2.child(patternIndex + 1);
    // Wildcard at end matches all remaining children
    if (!remainingPattern) {
      return {
        matches: true,
        metavariables: currentMetavars
      };
    }

    // Find first source child that matches the post-wildcard pattern
    while (sourceIndex < node1.childCount) {
      const sourceChild = node1.child(sourceIndex);
      if (!sourceChild) {
        sourceIndex++;
        continue;
      }

      if (this.isSemicolonNode(sourceChild)) {
        sourceIndex++;
        continue;
      }

      const nextResult = this.equalsWithMetavars(
        sourceChild,
        remainingPattern,
        currentMetavars
      );

      if (nextResult.matches) {
        return nextResult;
      }
      sourceIndex++;
    }
    return { matches: false, metavariables: currentMetavars };
  }

  /**
   * Matches member expressions by comparing object and property parts.
   */
  private matchMemberExpression(
    sourceNode: ASTNode,
    patternNode: ASTNode,
    currentMetavars: Metavariable = {}
  ): { matches: boolean; metavariables: Metavariable } {
    const sourceParts = this.getMemberParts(sourceNode);
    const patternParts = this.getMemberParts(patternNode);

    if (!sourceParts || !patternParts) {
      return { matches: false, metavariables: currentMetavars };
    }

    let updatedMetavars = { ...currentMetavars };

    // Handle nested member expressions in object part
    if (this.isMemberExpression(patternParts.object)) {
      if (!this.isMemberExpression(sourceParts.object)) {
        return { matches: false, metavariables: currentMetavars };
      }

      const objectResult = this.matchMemberExpression(
        sourceParts.object,
        patternParts.object,
        updatedMetavars
      );

      if (!objectResult.matches) {
        return { matches: false, metavariables: currentMetavars };
      }

      updatedMetavars = { ...updatedMetavars, ...objectResult.metavariables };
    } else if (this.isMetavariable(patternParts.object)) {
      const metavarName = patternParts.object.text;
      const objectText = this.getNodeText(sourceParts.object);

      if (updatedMetavars[metavarName] && updatedMetavars[metavarName] !== objectText) {
        return { matches: false, metavariables: currentMetavars };
      }

      updatedMetavars = { ...updatedMetavars, [metavarName]: objectText };
    } else {
      const objectResult = this.equalsWithMetavars(
        sourceParts.object,
        patternParts.object,
        updatedMetavars
      );

      if (!objectResult.matches) {
        return { matches: false, metavariables: currentMetavars };
      }

      updatedMetavars = { ...updatedMetavars, ...objectResult.metavariables };
    }

    if (this.isMetavariable(patternParts.property)) {
      const metavarName = patternParts.property.text;
      const propertyText = this.getNodeText(sourceParts.property);

      if (updatedMetavars[metavarName] && updatedMetavars[metavarName] !== propertyText) {
        return { matches: false, metavariables: currentMetavars };
      }

      updatedMetavars = { ...updatedMetavars, [metavarName]: propertyText };
    } else {
      const propertyResult = this.equalsWithMetavars(
        sourceParts.property,
        patternParts.property,
        updatedMetavars
      );

      if (!propertyResult.matches) {
        return { matches: false, metavariables: currentMetavars };
      }

      updatedMetavars = { ...updatedMetavars, ...propertyResult.metavariables };
    }

    return {
      matches: true,
      metavariables: updatedMetavars
    };
  }

  /**
   * Extracts object and property from member expression node.
   */
  private getMemberParts(node: ASTNode): { object: ASTNode; property: ASTNode } | null {
    if (!node || !this.isMemberExpression(node)) {
      return null;
    }

    const object = node.child(0);
    // child(1) is the dot
    const property = node.child(2);

    if (!object || !property) {
      return null;
    }

    let normalizedProperty = property;
    if (property.type === 'property_identifier') {
      normalizedProperty = {
        type: 'identifier',
        text: property.text,
        startIndex: property.startIndex,
        endIndex: property.endIndex,
        childCount: property.childCount,
        child: property.child,
        isNamed: property.isNamed
      } as ASTNode;
    }

    return { object, property: normalizedProperty };
  }

  /**
   * Reconstructs complete text from node and its children.
   */
  private getNodeText(node: ASTNode): string {
    if (!node) return '';

    if (node.childCount === 0) {
      return node.text;
    }

    let text = '';
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && (child.isNamed || !this.isSemicolonNode(child))) {
        text += this.getNodeText(child);
      }
    }
    return text;
  }

  private isWildcard(node: ASTNode | null): boolean {
    return node !== null && node.text.trim() === Matcher.WILDCARD_SYMBOL;
  }

  private isMetavariable(node: ASTNode | null): boolean {
    if (!node || this.isWildcard(node)) {
      return false;
    }
    return node.type === 'identifier' && node.text.startsWith('$');
  }

  private isSemicolonNode(node: ASTNode | null): boolean {
    return node !== null && node.type === ';';
  }

  private isMemberExpression(node: ASTNode | null): boolean {
    return node !== null && node.type === 'member_expression';
  }

  /**
   * Unwraps parser container nodes to find the actual pattern node.
   */
  private getDeepestSingleChild(node: ASTNode): ASTNode {
    let current = node;
    while (current.childCount === 1) {
      current = current.firstChild!;
    }
    return current;
  }
}