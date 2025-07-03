import { findByPattern } from '../src/api'; // Changed import
import { patternCases } from './cases/pattern-cases';

describe('findByPattern', () => { // Changed description
  patternCases.forEach(testCase => {
    it(`should correctly handle: ${testCase.name}`, async () => {
      const matches = await findByPattern(testCase.sourceCode, testCase.pattern); // Changed function call
      
      const simplifiedMatches = matches.map(match => ({
        matchedText: match.matchedText,
        metavariables: match.metavariables,
      }));

      expect(simplifiedMatches).toMatchSnapshot();
    });
  });
});