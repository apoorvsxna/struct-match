This is a guide to help you write rules using the syntax offered by struct-match.

## 1. Basic Pattern Matching

### Match exact code snippets or small syntax patterns.

```yaml
- id: direct
  rule:
    pattern: const x = 5

```

**Example code:**

```js
const x = 5;

```

Supports:

-   Whitespace/semicolon normalization
-   Line formatting tolerance

**Use when**: Matching simple statements or expressions.

----------

## 2. Metavariables

### Match variable parts of a pattern using `$VAR`

```yaml
- id: meta-vars
  rule:
    pattern: const $X = $Y

```

**Example code:**

```js
const name = getName();

```

Supports:

-   Identifier placeholders
-   Metavariable consistency
----------

## 3. Wildcards

### Use `$$$` to match zero or more AST nodes

```yaml
- id: wildcard-usage
  rule:
    pattern: function $FUNC() { $$$ console.log($X); $$$ }

```

**Example code:**

```js
function logIt() {
  const x = 10;
  console.log(x);
}

```

**Use when**: Matching code blocks with variable number of statements.

----------

## 4. Context-Aware Rules

### Add relationships between nodes using specifiers:

Specifier Description:

`inside` - Inner node within outer

`has` - Outer node wrapping inner

`follows` - Appears after

`precedes` - Appears before

```yaml
- id: inside-example
  rule:
    pattern: console.log($X)
    inside:
      pattern: function $NAME() { $$$ }

```

**Example code:**

```js
function show() {
  console.log("hello");
}

```

**Use when**: Enforcing structural/sequential constraints.

----------

## 5. Composite Rule - `any`

### Match if **any one** of the listed sub-rules matches

```yaml
- id: any-rule
  rule:
    any:
      - pattern: const $X = $Y
      - pattern: console.log($X)

```

**Example code:**

```js
const age = 30;
console.log(age);

```

**Use when**: You want logical OR behavior between rules.

----------

## 6. Nested Context Matching

### Create context-constraint inside other context-constraints

```yaml
- id: nested-context
  rule:
    pattern: function $FUNC() { $$$ }
    contains:
      pattern: var $A = "random"
      precedes:
        pattern: console.log($A)

```

**Example code:**

```js
function show() {
  var txt = "random";
  console.log(txt);
}

```