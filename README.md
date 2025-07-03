# struct-match

A library to search for JavaScript code patterns, with context constraints.

## Usage

You can search for code using either a simple string pattern or a more powerful YAML rule.

### 1\. Search using simple patterns

```javascript
import { findByPattern } from 'struct-match';

const sourceCode = `
  const a = 5;
  console.log(a);
  console.warn("beware");
`;

const pattern = `console.$FUNC($$$)`;

const matches = await findByPattern(sourceCode, pattern);
```

### 2\. Search using YAML rules

```javascript
import { findByRule } from 'struct-match';

const sourceCode = `
  const a = 5;
  console.log(a);
`;

const yamlRule = `
id: sample-rule
rule:
  pattern: console.log($X)
  follows:
    pattern: const $X = $$$
`;

const matches = await findByRule(sourceCode, yamlRule);

console.log(matches);
```

<mark>Refer to `RULES-GUIDE.md` for more instructions.</mark>