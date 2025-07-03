import { findByRule } from '../src/api'; // Changed import
import { ruleCases } from './cases/rule-cases';
import yaml from 'js-yaml';

describe('findByRule', () => { // Changed description
  ruleCases.forEach(testCase => {
    it(`should correctly handle: ${testCase.name}`, async () => {
      const fullRule = yaml.load(testCase.rule) as { rule: object };
      const rulePatternAsYaml = yaml.dump(fullRule.rule);

      const matches = await findByRule(testCase.sourceCode, testCase.rule); // Changed function call

      const simplifiedMatches = matches.map(match => ({
        ruleId: match.ruleId,
        matchedText: match.matchedText,
        startLine: match.startLine,
        endLine: match.endLine,
        metavariables: match.metavariables,
      }));

      expect(simplifiedMatches).toMatchSnapshot();
    });
  });
});