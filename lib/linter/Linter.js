const {
    Parser,
    GherkinClassicTokenMatcher,
    AstBuilder,
} = require("@cucumber/gherkin");
const { IdGenerator } = require("@cucumber/messages");
const _ = require("lodash");

const { Rules } = require("../rules");

module.exports = class Linter {
    #startTime = 0;

    constructor(config, options) {
        this.config = config;
        this.options = options;
        this.astParser = new Parser(
            new AstBuilder(IdGenerator.incrementing()),
            new GherkinClassicTokenMatcher()
        );
    }

    lint(text) {
        this.startTimer();
        const lintProblems = {
            elapsedTime: null,
            problems: [],
        };

        let problems = this.runRules(text);

        if (this.options.fix) {
            const { problems: hardProblems, text: fixedText } = this.fixLint(
                text,
                problems
            );
            problems = hardProblems;
            lintProblems.text = fixedText;
        }
        lintProblems.problems.push(...problems);

        lintProblems.elapsedTime = this.getElapsedTime();

        return lintProblems;
    }

    fixLint(text, problems) {
        problems.forEach((problem) => {
            if (Object.hasOwn(problem, "applyFix")) {
                text = problem.applyFix(text, problem);
                problems = this.runRules(text);
                this.fixLint(text, problems);
            }
        });
        return { problems, text };
    }

    runRules(text) {
        const ast = this.parseAst(text);
        const problems = [];
        // Run rules
        _.forOwn(Rules, (rule, id) => {
            problems.push(...rule.run(ast, this.getRuleConfig(id)));
        });
        return problems;
    }

    parseAst(text) {
        try {
            return this.astParser.parse(text);
        } catch (error) {
            console.log(error);
            throw new Error("Unable to parse Gherkin text");
        }
    }

    getRuleConfig(ruleId) {
        let rule = this.config.rules[ruleId];
        rule = typeof rule === "string" ? [rule] : rule;
        return {
            type: rule[0],
            option: [...rule.slice(1)],
        };
    }

    startTimer() {
        this.#startTime = Date.now();
    }

    getElapsedTime() {
        return Date.now() - this.#startTime;
    }
};