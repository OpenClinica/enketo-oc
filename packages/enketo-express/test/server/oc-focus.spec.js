const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const read = (theme) =>
    fs
        .readFileSync(
            path.resolve(__dirname, `../../public/css/${theme}.css`),
            'utf8'
        )
        // a trailing sourcemap comment is the only thing allowed after the last rule
        .replace(/\/\*# sourceMappingURL=[^*]*\*\/\s*$/, '');

const norm = (s) => s.trim().replace(/\s+/g, ' ');
const isFocus = (sel) => /:focus/.test(sel);

// Declarations that hide the focus indicator: outline 0/none anywhere, and
// !important outline, box-shadow or border in a :focus selector.
const suppressions = (css) => {
    const found = [];
    postcss.parse(css).walkDecls((d) => {
        if (d.parent.type !== 'rule') return;
        const value = d.value.replace(/\s*!important/, '').trim();
        const important = /!important/.test(d.value);
        const hidesOutline =
            (d.prop === 'outline' && /^(0|none)\b/.test(value)) ||
            (d.prop === 'outline-width' && /^0/.test(value)) ||
            (d.prop === 'outline-style' && value === 'none');
        const importantFocus =
            important &&
            isFocus(d.parent.selector) &&
            /^(outline|box-shadow|border)/.test(d.prop);
        if (hidesOutline || importantFocus) {
            found.push(`${norm(d.parent.selector)} { ${d.prop}: ${d.value} }`);
        }
    });

    return found;
};

const rulesMatching = (css, re) => {
    const rules = [];
    postcss.parse(css).walkRules((r) => {
        if (re.test(r.selector)) rules.push(r);
    });

    return rules;
};

const noImportantOutlineOrShadow = (rules) =>
    rules.every((r) => {
        let ok = true;
        r.walkDecls((d) => {
            if (
                /!important/.test(d.value) &&
                /^(outline|box-shadow|border)/.test(d.prop)
            ) {
                ok = false;
            }
        });

        return ok;
    });

// The vex theme's own two outline:none rules, overridden by the rules below
const VEX_VENDOR_RULES = [
    '.vex.vex-theme-plain .vex-dialog-form .vex-dialog-input select:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input textarea:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="date"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="datetime"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="datetime-local"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="email"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="month"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="number"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="password"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="search"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="tel"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="text"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="time"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="url"]:focus, .vex.vex-theme-plain .vex-dialog-form .vex-dialog-input input[type="week"]:focus { outline: none }',
    '.vex.vex-theme-plain .vex-dialog-button:focus { outline: none }',
];

// Every outline declared in a :focus rule must be the ring or be listed here.
// Entries are the rules that stay (selector { outline: value }).
const FOCUS_OUTLINE_ALLOW_LIST = VEX_VENDOR_RULES;

const focusOutlines = (css) => {
    const found = [];
    postcss.parse(css).walkDecls('outline', (d) => {
        if (d.parent.type !== 'rule' || !isFocus(d.parent.selector)) return;
        if (norm(d.value) === '2px solid var(--oc-focus)') return;
        found.push(`${norm(d.parent.selector)} { outline: ${d.value} }`);
    });

    return found;
};

describe('OC focus ring', () => {
    ['theme-oc', 'theme-formhub', 'theme-grid'].forEach((theme) =>
        describe(theme, () => {
            const css = read(theme);

            it('ends with the global focus rule', () => {
                expect(css).to.match(
                    /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--oc-focus\)[^}]*outline-offset:\s*2px[^}]*\}\s*$/
                );
            });

            it('has no focus suppression left outside the allow list', () => {
                expect(suppressions(css)).to.deep.equal(VEX_VENDOR_RULES);
            });

            it('overrides the vex theme suppression', () => {
                expect(css).to.match(
                    /\.vex\.vex-theme-plain [^{]*\.vex-dialog-button:focus-visible[^{]*\{[^}]*outline:\s*2px solid var\(--oc-focus\)/
                );
                expect(css).to.match(
                    /\.vex\.vex-theme-plain [^{]*\.vex-dialog-input input\[type\]:focus-visible[^{]*\{[^}]*outline:\s*2px solid var\(--oc-focus\)/
                );
            });

            it('has no :focus rule with an outline other than the ring or the allow list', () => {
                expect(focusOutlines(css)).to.deep.equal(
                    FOCUS_OUTLINE_ALLOW_LIST
                );
            });

            it('rings the drawn image of a keyboard-focused no-buttons option, and only there', () => {
                const sels = [];
                postcss.parse(css).walkRules((r) => {
                    if (
                        /input:focus-visible ?~ ?\.active/.test(r.selector) &&
                        /2px solid var\(--oc-focus\)/.test(r.toString())
                    ) {
                        sels.push(norm(r.selector));
                    }
                });
                expect(sels).to.deep.equal([
                    '.or-appearance-no-buttons .option-wrapper > label input:focus-visible ~ .active',
                ]);
            });

            it('keeps no !important focus rule in .oc-view', () => {
                const rules = rulesMatching(css, /\.oc-view[^{]*:focus/);
                expect(rules).to.satisfy(noImportantOutlineOrShadow);
            });
        })
    );
});
