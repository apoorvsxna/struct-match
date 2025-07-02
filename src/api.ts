import { Match, RulePattern } from './types';
import { CodeParser } from './core/Parser';
import { Matcher } from './core/Matcher';
import { RuleProcessor } from './core/RuleProcessor';
import { getLineNumbers, getMatchText } from './utils/NodeAnalyzer';

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
export async function findPatternMatches(
  sourceCode: string,
  pattern: string
): Promise<Match[]> {
  const sourceTree = codeParser.parse(sourceCode);
  const rule: RulePattern = { pattern };

  const intermediateMatches = matcher.find(sourceTree, rule);

  return intermediateMatches.map(({ node, metavariables }) => {
    const { startLine, endLine } = getLineNumbers(sourceCode, node);
    const matchedText = getMatchText(node); // Using the simplified name

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
 * @param yamlRule A string containing the rule in YAML format.
 * @returns A promise that resolves to an array of all found matches.
 */
export async function findMatchesByRule(
  sourceCode: string,
  yamlRule: string
): Promise<Match[]> {
  const sourceTree = codeParser.parse(sourceCode);
  const intermediateMatches = await ruleProcessor.process(sourceTree, yamlRule);

  return intermediateMatches.map(({ node, metavariables }) => {
    const { startLine, endLine } = getLineNumbers(sourceCode, node);
    const matchedText = getMatchText(node); // Using the simplified name

    return {
      node,
      matchedText,
      startLine,
      endLine,
      metavariables,
    };
  });
}