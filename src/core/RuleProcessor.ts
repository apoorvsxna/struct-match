import yaml from 'js-yaml';
import Parser from 'tree-sitter';
import { ASTNode, Metavariable, RulePattern } from '../types';
import { Matcher } from './Matcher';

type IntermediateMatch = { node: ASTNode; metavariables: Metavariable };

/**
 * Responsible for processing YAML rules.
 */
export class RuleProcessor {
  private matcher: Matcher;

  constructor(matcher: Matcher) {
    this.matcher = matcher;
  }

  /**
   * Processes a YAML rule string against a source code AST.
   */
  public async process(
    sourceTree: Parser.Tree,
    yamlRule: string
  ): Promise<IntermediateMatch[]> {
    const rule = this.parseAndValidate(yamlRule);
    return this.findValidMatches(sourceTree, rule);
  }

  /**
   * Recursively finds matches that satisfy a rule and all its context constraints.
   */
  private async findValidMatches(
    sourceTree: Parser.Tree,
    rule: RulePattern,
    parentMetavars: Metavariable = {}
  ): Promise<IntermediateMatch[]> {
    let candidateMatches: IntermediateMatch[] = [];

    // Step 1: Find initial candidates (based on `pattern` or `any`).
    if (rule.pattern) {
      candidateMatches = this.matcher.find(sourceTree, { pattern: rule.pattern });
    } else if (rule.any) {
      for (const subPattern of rule.any) {
        const anyMatches = await this.findValidMatches(sourceTree, subPattern);
        candidateMatches.push(...anyMatches);
      }
    }
    // If there's no `pattern` or `any`, candidateMatches remains empty.
    // This is correct, as contextual rules should only filter a set of primary matches.

    let matches = candidateMatches.filter(match =>
      this.areMetavarsConsistent(parentMetavars, match.metavariables)
    );

    // Step 2: Sequentially apply all contextual filters.
    if (rule.inside) {
      const insideMatches = await this.findValidMatches(sourceTree, rule.inside, parentMetavars);
      matches = matches.filter(match =>
        insideMatches.some(container => this.isInside(match.node, container.node))
      );
    }

    if (rule.not) {
      const notMatches = await this.findValidMatches(sourceTree, rule.not, parentMetavars);
      matches = matches.filter(
        match => !notMatches.some(notMatch => notMatch.node.id === match.node.id)
      );
    }

    if (rule.contains) {
        const containsMatches = await this.findValidMatches(sourceTree, rule.contains, parentMetavars);
        matches = matches.filter(match => 
            containsMatches.some(inner => this.isInside(inner.node, match.node))
        );
    }
    
    if (rule.follows) {
        const followsMatches = await this.findValidMatches(sourceTree, rule.follows, parentMetavars);
        matches = matches.filter(match => 
            followsMatches.some(prev => this.follows(match.node, prev.node))
        );
    }
    
    if (rule.precedes) {
        const precedesMatches = await this.findValidMatches(sourceTree, rule.precedes, parentMetavars);
        matches = matches.filter(match => 
            precedesMatches.some(next => this.precedes(match.node, next.node))
        );
    }

    return matches;
  }

  private parseAndValidate(yamlRule: string): RulePattern {
    try {
      const rule = yaml.load(yamlRule) as RulePattern;
      if (!rule || (typeof rule !== 'object')) {
        throw new Error('Rule must be a valid YAML object.');
      }
      return rule;
    } catch (error: any) {
      throw new Error(`Failed to parse YAML rule: ${error.message}`);
    }
  }

  private isInside(nodeA: ASTNode, nodeB: ASTNode): boolean {
    return nodeA.startIndex >= nodeB.startIndex && nodeA.endIndex <= nodeB.endIndex;
  }
  
  private follows(nodeA: ASTNode, nodeB: ASTNode): boolean {
      return nodeA.startIndex >= nodeB.endIndex;
  }
  
  private precedes(nodeA: ASTNode, nodeB: ASTNode): boolean {
      return nodeA.endIndex <= nodeB.startIndex;
  }

  private areMetavarsConsistent(
    existing: Metavariable,
    incoming: Metavariable
  ): boolean {
    for (const key in incoming) {
      if (existing[key] && existing[key] !== incoming[key]) {
        return false;
      }
    }
    return true;
  }
}