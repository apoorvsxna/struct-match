import Parser from "tree-sitter";
import { ASTNode, Metavariable, RulePattern } from "../types";
import { CodeParser } from "./Parser";

/**
 * Finds pattern matches in AST using metavariables ($VAR) and wildcards ($$$).
 */
export class Matcher {
  private parser: CodeParser;
  private static readonly WILDCARD_SYMBOL = "$$$";

  constructor(parser: CodeParser) {
    this.parser = parser;
  }

  /**
   * Finds all nodes matching the given pattern.
   */
  public find(
    sourceTree: Parser.Tree,
    pattern: RulePattern,
  ): { node: ASTNode; metavariables: Metavariable }[] {
    if (!pattern.pattern) {
      return [];
    }

    const patternTree = this.parser.parse(pattern.pattern);
    const targetNode = this.getDeepestSingleChild(patternTree.rootNode);
    const candidateNodes = this.parser.getNodesOfType(
      sourceTree,
      targetNode.type,
    );

    return this.findMatchesInCandidates(candidateNodes, targetNode);
  }

  private findMatchesInCandidates(
    candidateNodes: ASTNode[],
    targetNode: ASTNode,
  ): { node: ASTNode; metavariables: Metavariable }[] {
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
    currentMetavars: Metavariable = {},
  ): { matches: boolean; metavariables: Metavariable } {
    if (!node1 || !node2) {
      return { matches: false, metavariables: currentMetavars };
    }

    // Skip semicolons as they're syntactic sugar
    if (this.isSemicolonNode(node1) || this.isSemicolonNode(node2)) {
      return this.createMatchResult(true, currentMetavars);
    }

    // Wildcard matches any single node
    if (this.isWildcard(node2)) {
      return this.createMatchResult(true, currentMetavars);
    }

    // Handle metavariable capture and consistency
    if (this.isMetavariable(node2)) {
      return this.handleMetavariableMatch(node1, node2, currentMetavars);
    }

    // Member expressions need special handling due to nested structure
    if (this.isMemberExpression(node2)) {
      return this.handleMemberExpressionMatch(node1, node2, currentMetavars);
    }

    // Compare node types with normalization
    if (!this.areTypesCompatible(node1, node2)) {
      return this.createMatchResult(false, currentMetavars);
    }

    // For leaves, compare text directly
    if (node1.childCount === 0) {
      return this.createMatchResult(node1.text === node2.text, currentMetavars);
    }

    return this.compareChildren(node1, node2, currentMetavars);
  }

  private createMatchResult(
    matches: boolean,
    metavariables: Metavariable,
  ): { matches: boolean; metavariables: Metavariable } {
    return { matches, metavariables };
  }

  private handleMetavariableMatch(
    sourceNode: ASTNode,
    patternNode: ASTNode,
    currentMetavars: Metavariable,
  ): { matches: boolean; metavariables: Metavariable } {
    const metavarName = patternNode.text;
    const nodeText = this.getNodeText(sourceNode);

    if (!currentMetavars[metavarName]) {
      return this.createMatchResult(true, {
        ...currentMetavars,
        [metavarName]: nodeText,
      });
    }

    return this.createMatchResult(
      currentMetavars[metavarName] === nodeText,
      currentMetavars,
    );
  }

  private handleMemberExpressionMatch(
    sourceNode: ASTNode,
    patternNode: ASTNode,
    currentMetavars: Metavariable,
  ): { matches: boolean; metavariables: Metavariable } {
    if (!this.isMemberExpression(sourceNode)) {
      return this.createMatchResult(false, currentMetavars);
    }

    return this.matchMemberExpression(sourceNode, patternNode, currentMetavars);
  }

  private areTypesCompatible(node1: ASTNode, node2: ASTNode): boolean {
    const type1 = this.normalizeNodeType(node1.type);
    const type2 = this.normalizeNodeType(node2.type);
    return type1 === type2;
  }

  private normalizeNodeType(type: string): string {
    return type === "property_identifier" ? "identifier" : type;
  }

  /**
   * Compares children, handling wildcards and skipping semicolons.
   */
  private compareChildren(
    node1: ASTNode,
    node2: ASTNode,
    currentMetavars: Metavariable,
  ): { matches: boolean; metavariables: Metavariable } {
    let currentMetavariables = { ...currentMetavars };
    let sourceIndex = 0;
    let patternIndex = 0;

    while (patternIndex < node2.childCount) {
      const indices = this.skipSemicolons(
        node1,
        node2,
        sourceIndex,
        patternIndex,
      );
      sourceIndex = indices.sourceIndex;
      patternIndex = indices.patternIndex;

      if (patternIndex >= node2.childCount) break;

      const patternChild = node2.child(patternIndex);
      if (!patternChild) break;

      const childResult = this.processChildNode(
        node1,
        node2,
        sourceIndex,
        patternIndex,
        currentMetavariables,
        currentMetavars,
      );

      if (!childResult.matches) {
        return this.createMatchResult(false, currentMetavars);
      }

      if (childResult.consumed) {
        return childResult.result;
      }

      currentMetavariables = childResult.result.metavariables;
      sourceIndex++;
      patternIndex++;
    }

    sourceIndex = this.skipTrailingSemicolons(node1, sourceIndex);

    return this.createMatchResult(
      sourceIndex === node1.childCount,
      currentMetavariables,
    );
  }

  private skipSemicolons(
    node1: ASTNode,
    node2: ASTNode,
    sourceIndex: number,
    patternIndex: number,
  ): { sourceIndex: number; patternIndex: number } {
    // Skip semicolons in pattern
    while (patternIndex < node2.childCount) {
      const patternChild = node2.child(patternIndex);
      if (!patternChild || !this.isSemicolonNode(patternChild)) break;
      patternIndex++;
    }

    // Skip semicolons in source
    while (sourceIndex < node1.childCount) {
      const sourceChild = node1.child(sourceIndex);
      if (!sourceChild || !this.isSemicolonNode(sourceChild)) break;
      sourceIndex++;
    }

    return { sourceIndex, patternIndex };
  }

  private skipTrailingSemicolons(node: ASTNode, startIndex: number): number {
    let index = startIndex;
    while (index < node.childCount) {
      const child = node.child(index);
      if (!child || !this.isSemicolonNode(child)) break;
      index++;
    }
    return index;
  }

  private processChildNode(
    node1: ASTNode,
    node2: ASTNode,
    sourceIndex: number,
    patternIndex: number,
    currentMetavariables: Metavariable,
    originalMetavars: Metavariable,
  ): {
    matches: boolean;
    result: { matches: boolean; metavariables: Metavariable };
    consumed: boolean;
  } {
    const patternChild = node2.child(patternIndex);
    if (!patternChild) {
      return {
        matches: false,
        result: this.createMatchResult(false, originalMetavars),
        consumed: false,
      };
    }

    // Handle wildcard matching
    if (this.isWildcard(patternChild)) {
      const result = this.handleWildcardMatch(
        node1,
        node2,
        sourceIndex,
        patternIndex,
        currentMetavariables,
      );
      return {
        matches: result.matches,
        result,
        consumed: true,
      };
    }

    // Handle regular child matching
    if (sourceIndex >= node1.childCount) {
      return {
        matches: false,
        result: this.createMatchResult(false, originalMetavars),
        consumed: false,
      };
    }

    const sourceChild = node1.child(sourceIndex);
    if (!sourceChild) {
      return {
        matches: false,
        result: this.createMatchResult(false, originalMetavars),
        consumed: false,
      };
    }

    const childResult = this.equalsWithMetavars(
      sourceChild,
      patternChild,
      currentMetavariables,
    );

    return {
      matches: childResult.matches,
      result: childResult,
      consumed: false,
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
    currentMetavars: Metavariable,
  ): { matches: boolean; metavariables: Metavariable } {
    const remainingPattern = node2.child(patternIndex + 1);

    // Wildcard at end matches all remaining children
    if (!remainingPattern) {
      return this.createMatchResult(true, currentMetavars);
    }

    return this.findWildcardMatch(
      node1,
      remainingPattern,
      sourceIndex,
      currentMetavars,
    );
  }

  private findWildcardMatch(
    node1: ASTNode,
    remainingPattern: ASTNode,
    sourceIndex: number,
    currentMetavars: Metavariable,
  ): { matches: boolean; metavariables: Metavariable } {
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
        currentMetavars,
      );

      if (nextResult.matches) {
        return nextResult;
      }
      sourceIndex++;
    }

    return this.createMatchResult(false, currentMetavars);
  }

  /**
   * Matches member expressions by comparing object and property parts.
   */
  private matchMemberExpression(
    sourceNode: ASTNode,
    patternNode: ASTNode,
    currentMetavars: Metavariable = {},
  ): { matches: boolean; metavariables: Metavariable } {
    const sourceParts = this.getMemberParts(sourceNode);
    const patternParts = this.getMemberParts(patternNode);

    if (!sourceParts || !patternParts) {
      return this.createMatchResult(false, currentMetavars);
    }

    const objectResult = this.matchMemberObject(
      sourceParts,
      patternParts,
      currentMetavars,
    );
    if (!objectResult.matches) {
      return this.createMatchResult(false, currentMetavars);
    }

    const propertyResult = this.matchMemberProperty(
      sourceParts,
      patternParts,
      objectResult.metavariables,
    );

    return propertyResult;
  }

  private matchMemberObject(
    sourceParts: { object: ASTNode; property: ASTNode },
    patternParts: { object: ASTNode; property: ASTNode },
    currentMetavars: Metavariable,
  ): { matches: boolean; metavariables: Metavariable } {
    if (this.isMemberExpression(patternParts.object)) {
      if (!this.isMemberExpression(sourceParts.object)) {
        return this.createMatchResult(false, currentMetavars);
      }

      return this.matchMemberExpression(
        sourceParts.object,
        patternParts.object,
        currentMetavars,
      );
    }

    if (this.isMetavariable(patternParts.object)) {
      return this.handleMetavariableInMember(
        sourceParts.object,
        patternParts.object,
        currentMetavars,
      );
    }

    return this.equalsWithMetavars(
      sourceParts.object,
      patternParts.object,
      currentMetavars,
    );
  }

  private matchMemberProperty(
    sourceParts: { object: ASTNode; property: ASTNode },
    patternParts: { object: ASTNode; property: ASTNode },
    currentMetavars: Metavariable,
  ): { matches: boolean; metavariables: Metavariable } {
    if (this.isMetavariable(patternParts.property)) {
      return this.handleMetavariableInMember(
        sourceParts.property,
        patternParts.property,
        currentMetavars,
      );
    }

    return this.equalsWithMetavars(
      sourceParts.property,
      patternParts.property,
      currentMetavars,
    );
  }

  private handleMetavariableInMember(
    sourceNode: ASTNode,
    patternNode: ASTNode,
    currentMetavars: Metavariable,
  ): { matches: boolean; metavariables: Metavariable } {
    const metavarName = patternNode.text;
    const nodeText = this.getNodeText(sourceNode);

    if (
      currentMetavars[metavarName] &&
      currentMetavars[metavarName] !== nodeText
    ) {
      return this.createMatchResult(false, currentMetavars);
    }

    return this.createMatchResult(true, {
      ...currentMetavars,
      [metavarName]: nodeText,
    });
  }

  /**
   * Extracts object and property from member expression node.
   */
  private getMemberParts(
    node: ASTNode,
  ): { object: ASTNode; property: ASTNode } | null {
    if (!node || !this.isMemberExpression(node)) {
      return null;
    }

    const object = node.child(0);
    const property = node.child(2); // child(1) is the dot

    if (!object || !property) {
      return null;
    }

    return {
      object,
      property: this.normalizePropertyNode(property),
    };
  }

  private normalizePropertyNode(property: ASTNode): ASTNode {
    if (property.type === "property_identifier") {
      return {
        type: "identifier",
        text: property.text,
        startIndex: property.startIndex,
        endIndex: property.endIndex,
        childCount: property.childCount,
        child: property.child,
        isNamed: property.isNamed,
      } as ASTNode;
    }
    return property;
  }

  /**
   * Reconstructs complete text from node and its children.
   */
  private getNodeText(node: ASTNode): string {
    if (!node) return "";

    if (node.childCount === 0) {
      return node.text;
    }

    return this.buildTextFromChildren(node);
  }

  private buildTextFromChildren(node: ASTNode): string {
    let text = "";
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && (child.isNamed || !this.isSemicolonNode(child))) {
        text += this.getNodeText(child);
      }
    }
    return text;
  }

  // Node type checking methods
  private isWildcard(node: ASTNode | null): boolean {
    return node !== null && node.text.trim() === Matcher.WILDCARD_SYMBOL;
  }

  private isMetavariable(node: ASTNode | null): boolean {
    if (!node || this.isWildcard(node)) {
      return false;
    }
    return node.type === "identifier" && node.text.startsWith("$");
  }

  private isSemicolonNode(node: ASTNode | null): boolean {
    return node !== null && node.type === ";";
  }

  private isMemberExpression(node: ASTNode | null): boolean {
    return node !== null && node.type === "member_expression";
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
