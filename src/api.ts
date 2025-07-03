import { Match, RulePattern } from './types';
import { CodeParser } from './core/Parser';
import { Matcher } from './core/Matcher';
import { RuleProcessor } from './core/RuleProcessor';
import { getLineNumbers, getMatchText } from './utils/NodeAnalyzer';
import yaml from 'js-yaml';

const codeParser = new CodeParser();
const matcher = new Matcher(codeParser);
const ruleProcessor = new RuleProcessor(matcher);

/**
 * Finds all occurrences of a simple pattern string in the given source code.
 * @param sourceCode The source code to analyze.
 * @param pattern The pattern to search for
 * @returns A promise that resolves to an array of all found matches.
 */
export async function findByPattern(
  sourceCode: string,
  pattern: string
): Promise<Omit<Match, 'ruleId'>[]> {
  const sourceTree = codeParser.parse(sourceCode);
  const rule: RulePattern = { pattern };

  const intermediateMatches = matcher.find(sourceTree, rule);

  return intermediateMatches.map(({ node, metavariables }) => {
    const { startLine, endLine } = getLineNumbers(sourceCode, node);
    const matchedText = getMatchText(node);

    return {
      node,
      matchedText,
      startLine,
      endLine,
      metavariables,
    };
  });
}

/**
 * Finds all matches in the source code based on a YAML rule
 * or an array of rules.
 * @param sourceCode The source code to analyze.
 * @param yamlRule A string containing one or more rules in YAML format.
 * @returns A promise that resolves to an array of all found matches.
 */
export async function findByRule(
  sourceCode: string,
  yamlRule: string
): Promise<Match[]> {
  const sourceTree = codeParser.parse(sourceCode);
  const loadedYaml = yaml.load(yamlRule);

  const rules = Array.isArray(loadedYaml) ? loadedYaml : [loadedYaml];

  const allMatches: Match[] = [];

  for (const fullRule of rules) {
    // Silently skip any malformed entries in the array.
    if (!fullRule || typeof fullRule.id !== 'string' || typeof fullRule.rule !== 'object') {
      continue;
    }

    const ruleId = fullRule.id;
    const rulePatternAsYaml = yaml.dump(fullRule.rule);

    const intermediateMatches = await ruleProcessor.process(
      sourceTree,
      rulePatternAsYaml
    );

    const matchesForThisRule = intermediateMatches.map(({ node, metavariables }) => {
      const { startLine, endLine } = getLineNumbers(sourceCode, node);
      const matchedText = getMatchText(node);

      return {
        ruleId,
        node,
        matchedText,
        startLine,
        endLine,
        metavariables,
      };
    });

    allMatches.push(...matchesForThisRule);
  }

  return allMatches;
}