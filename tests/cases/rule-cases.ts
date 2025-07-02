interface RuleTestCase {
  name: string;
  sourceCode: string;
  rule: object; 
}

export const ruleCases: RuleTestCase[] = [
    {
        name: 'Single Pattern, Direct',
        sourceCode: `
            const x = 5;
            const y = 10;
        `,
        rule: {
            pattern: 'const x = 5',
        },
    },
    {
        name: 'Context Specifier - inside',
        sourceCode: `
            function go() {
                console.log("random");
            }
        `,
        rule: {
            pattern: 'console.log("random")',
            inside: {
                pattern: 'function $X() {$$$}',
            },
        },
    },
    {
        name: 'Context Specifier - follows',
        sourceCode: `
            const x = 5;
            function go() {}
            console.log(x);
        `,
        rule: {
            pattern: 'console.log(x)',
            follows: {
                pattern: 'const x=5',
            },
        },
    },
    {
        name: 'Context Specifier - precedes',
        sourceCode: `
            console.log(x);
            const y = 5;
        `,
        rule: {
            pattern: 'console.log(x)',
            precedes: {
                pattern: 'const y=5',
            },
        },
    },
    {
        name: 'Context Specifier - contains (has)',
        sourceCode: `
            function go() {
                console.log("random");
            }
        `,
        rule: {
            pattern: 'function $X() {$$$}',
            has: {
                pattern: 'console.log("random")',
            },
        },
    },
    {
        name: 'Context Specifier - not',
        sourceCode: `
            console.log("goodbye");
            console.log("hello");
        `,
        rule: {
            pattern: 'console.log($$$)',
            not: {
                pattern: 'console.log("hello")',
            },
        },
    },
    {
        name: 'Composite Rule - any',
        sourceCode: `
            const x = 5;
            function go() {
                console.log("random");
            }
        `,
        rule: {
            any: [
                { pattern: 'const $X = $Y' },
                { 
                    pattern: 'console.log($X)',
                    inside: {
                        pattern: 'function $FUNC(){$$$}',
                    }
                }
            ]
        },
    },
    {
        name: 'Multiple context specifiers (non-nested)',
        sourceCode: `
            const x = 5;
            function go() {
                console.log("random");
            }
        `,
        rule: {
            pattern: 'console.log($$$)',
            inside: {
                pattern: 'function $FUNC(){$$$}',
            },
            follows: {
                pattern: 'const $X = $Y',
            },
        },
    },
    {
        name: 'Multiple context specifiers (nested)',
        sourceCode: `
            function go() {
                var text = "random";
                console.log(text);
            }
        `,
        rule: {
            pattern: 'function $FUNC(){$$$}',
            has: {
                pattern: 'var text = "random"',
                precedes: {
                    pattern: 'console.log($A)',
                },
            },
        },
    },
    {
        name: 'Metavariable consistency across context specifiers',
        sourceCode: `
            function go() {
                var text = "random";
                console.log(text);
            }
        `,
        rule: {
            pattern: 'function $FUNC(){$$$}',
            has: {
                pattern: 'var $A = "random"',
                precedes: {
                    pattern: 'console.log($A)',
                },
            },
        },
    },
];