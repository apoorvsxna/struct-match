interface PatternTestCase {
  name: string;
  sourceCode: string;
  pattern: string;
}

export const patternCases: PatternTestCase[] = [
    {
        name: 'Direct matching',
        sourceCode: `
            const x = 5;
            const y = 10;
        `,
        pattern: `const x = 5`,
    },
    {
        name: 'Bare Identifier',
        sourceCode: `
            const x = 5;
            const y = 10;
        `,
        pattern: `y`,
    },
    {
        name: 'Metavariables',
        sourceCode: `
            const x = 5;
            console.log(x);
            const y = 5;
        `,
        pattern: `const $A = 5`,
    },
    {
        name: 'Metavariables on both sides',
        sourceCode: `
            const x = 5;
            const y = 10;
        `,
        pattern: `const $A = $B`,
    },
    {
        name: 'Metavariable consistency',
        sourceCode: `
            const x = x + 5;
        `,
        pattern: `const $A = $A + $B`,
    },
    {
        name: 'Metavariable matching complex node',
        sourceCode: `
            const x = 5;
            function go(x) {
                if(x > 2){
                    return x;
                }
            }
            console.log( go(x+5) );
        `,
        pattern: `console.log($X)`,
    },
    {
        name: 'Whitespace',
        sourceCode: `
            const x=  5;
        `,
        pattern: `const $A = $B`,
    },
    {
        name: 'Semicolon',
        sourceCode: `
            const x = 5;
        `,
        pattern: `const x=5`,
    },
    {
        name: 'Wildcard matching one node',
        sourceCode: `
            function go() {
                var a = 5;
                console.log("random");
            }
        `,
        pattern: `function go() {
            $$$
            console.log($X);
        }`,
    },
    {
        name: 'Wildcard matching multiple nodes',
        sourceCode: `
            function go() {
                var a = 5;
                var c = 10;
                if(c == 2) {
                    c = c + 1;
                }
                console.log("random");
            }
        `,
        pattern: `function go() {
            $$$
            console.log($X);
        }`,
    },
    {
        name: 'Wildcard matching zero nodes',
        sourceCode: `
            function go() {
                console.log("random");
            }
        `,
        pattern: `function go() {
            $$$
            console.log($X);
        }`,
    },
    {
        name: 'Wildcard with nesting',
        sourceCode: `
            function go(x) {
                var a = 5;
                if(x > a) {
                    x = x+10;
                    console.log("yes");
                }
                return x;
            }
        `,
        pattern: `function go(x) {
            $$$
            if(x > a) {
                $$$
                x = x+10;
                $$$
            }
            return x;
        }`,
    },
    {
        name: 'Varying node type due to context',
        sourceCode: `
            http.createServer(function (request, response) {
                curl(url,
                    {
                        SSL_VERIFYPEER: 0
                    },
                    function (err) {
                        response.end(this.body);
                    })
            });
        `,
        pattern: `{SSL_VERIFYPEER: 0}`,
    },
    {
        name: 'Chained expressions',
        sourceCode: `
            con.query("SELECT * FROM person WHERE id = '" +
            req.body.input + "'");
        `,
        pattern: `req.body.input`,
    },
    {
        name: 'Chained expressions with metavariables',
        sourceCode: `
            const result = req.body.input;
        `,
        pattern: `$X.$Y.$Z`,
    },
];