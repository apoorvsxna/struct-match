import { findMatchesByRule } from '../src/api';
import { ruleCases } from './cases/rule-cases';
import yaml from 'js-yaml';

describe('findMatchesByRule', () => {
  ruleCases.forEach(testCase => {
    it(`should correctly handle: ${testCase.name}`, async () => {
      // We just need to dump the rule object to a YAML string.
      const yamlStringToTest = yaml.dump(testCase.rule);

      const matches = await findMatchesByRule(testCase.sourceCode, yamlStringToTest);

      const simplifiedMatches = matches.map(match => ({
        matchedText: match.matchedText,
        metavariables: match.metavariables,
      }));

      expect(simplifiedMatches).toMatchSnapshot();
    });
  });
});
