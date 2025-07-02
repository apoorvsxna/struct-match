import { findPatternMatches } from '../src/api';
import { patternCases } from './cases/pattern-cases'; // Changed import

describe('findPatternMatches', () => {
  patternCases.forEach(testCase => { // testCase is now strongly typed
    it(`should correctly handle: ${testCase.name}`, async () => {
      const matches = await findPatternMatches(testCase.sourceCode, testCase.pattern);
      
      const simplifiedMatches = matches.map(match => ({
        matchedText: match.matchedText,
        metavariables: match.metavariables,
      }));

      expect(simplifiedMatches).toMatchSnapshot();
    });
  });
});