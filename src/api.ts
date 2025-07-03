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
 *
 * @param sourceCode The source code to analyze.
 * @param pattern The pattern to search for (e.g., "console.log($VAR)").
 * @returns A promise that resolves to an array of all found matches.
 */
export async function findByPattern(
  sourceCode: string,
  pattern: string
): Promise<Omit<Match, 'ruleId'>[]> { // <-- The fix is here: added []
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
 * Finds all matches in the source code based on a structured YAML rule.
 *
 * @param sourceCode The source code to analyze.
 * @param yamlRule A string containing the rule (with id) in YAML format.
 * @returns A promise that resolves to an array of all found matches.
 */
export async function findByRule(
  sourceCode: string,
  yamlRule: string
): Promise<Match[]> {
  const fullRule = yaml.load(yamlRule) as { id: string; rule: object };
  const ruleId = fullRule.id;
  const rulePattern = fullRule.rule;

  const rulePatternAsYaml = yaml.dump(rulePattern);

  const sourceTree = codeParser.parse(sourceCode);
  const intermediateMatches = await ruleProcessor.process(
    sourceTree,
    rulePatternAsYaml
  );

  return intermediateMatches.map(({ node, metavariables }) => {
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
}