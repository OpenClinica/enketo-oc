const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const styles = path.resolve(__dirname, '../../app/views/styles');
const tokenSource = fs.readFileSync(
    path.join(styles, 'component/_oc-tokens.scss'),
    'utf8'
);
const mapBody = tokenSource.match(/\$oc-tokens:\s*\(([\s\S]*?)\)\s*;/)[1];
const tokens = {};
[...mapBody.matchAll(/['"]?([a-z-]+)['"]?\s*:\s*(#[0-9a-fA-F]{6})/g)].forEach(
    ([, name, value]) => {
        tokens[name] = value.toLowerCase();
    }
);

// WCAG relative-luminance contrast ratio (sources/contrast.py)
const lum = (hex) => {
    const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
};

const backgrounds = [
    '#ffffff', // white
    '#f0f0f0', // page
    '#eeeeee', // disabled input
    '#f2dede', // invalid question
    '#fcd4b2', // strict question
    '#fde2cb', // option hover
    '#f1f1f1', // reason-for-change panel
    '#e4e4e4', // query list
];

const expectRatio = (fg, bgs, min) =>
    bgs.forEach((bg) => {
        expect(ratio(fg, bg), `${fg} on ${bg}`).to.be.at.least(min);
    });

describe('OC tokens', () => {
    it('every token equals its Token Table value', () => {
        expect(tokens).to.deep.equal({
            accent: '#b13300',
            'accent-hover': '#c25700',
            'input-border': '#7c7c7c',
            'secondary-text': '#606060',
            error: '#a43f3e',
            focus: '#0070dc',
            'query-new': '#fa0000',
            'icon-muted': '#8a8a8a',
            'jump-nav-text': '#1b1b1b',
        });
    });

    it('accent, secondary-text and error reach 4.5 on white, #f0f0f0, #f2dede, #fcd4b2', () => {
        const bgs = ['#ffffff', '#f0f0f0', '#f2dede', '#fcd4b2'];
        ['accent', 'secondary-text', 'error'].forEach((n) =>
            expectRatio(tokens[n], bgs, 4.5)
        );
    });

    it('white text on accent and accent-hover reaches 4.5', () => {
        expectRatio('#ffffff', [tokens.accent, tokens['accent-hover']], 4.5);
    });

    it('input-border, focus and query-new reach 3 on all eight backgrounds', () => {
        ['input-border', 'focus', 'query-new'].forEach((n) =>
            expectRatio(tokens[n], backgrounds, 3)
        );
    });

    it('icon-muted reaches 3 on white and #f0f0f0', () => {
        expectRatio(tokens['icon-muted'], ['#ffffff', '#f0f0f0'], 3);
    });

    describe('built theme-oc.css, remaining colour rows', () => {
        const css = fs.readFileSync(
            path.resolve(__dirname, '../../public/css/theme-oc.css'),
            'utf8'
        );
        const root = postcss.parse(css);
        const spec = (sel) => [
            (sel.match(/#/g) || []).length,
            (sel.match(/\.[\w-]+|\[[^\]]*\]|:(?!:|not\b)[\w-]+/g) || []).length,
        ];
        const cmp = (a, b) => a[0] - b[0] || a[1] - b[1];
        // Winning colour for a selector: highest specificity, then last in source order
        const winningColor = (target) => {
            let best;
            root.walkRules((rule) => {
                const decl = rule.nodes.filter((n) => n.prop === 'color').pop();
                if (!decl) return;
                rule.selectors
                    .map((s) => s.trim().replace(/\s+/g, ' '))
                    .filter((s) => s.endsWith(target))
                    .forEach((s) => {
                        if (!best || cmp(spec(s), best.spec) >= 0) {
                            best = { spec: spec(s), value: decl.value };
                        }
                    });
            });

            return best;
        };

        [
            '.or-comment-widget__content__btn-close-x',
            '.vex.vex-theme-plain .vex-close:before',
        ].forEach((sel) =>
            it(`${sel} uses --oc-icon-muted`, () => {
                const win = winningColor(sel);
                expect(win.value.toLowerCase()).to.equal(
                    'var(--oc-icon-muted)'
                );
                expect(cmp(win.spec, spec(sel))).to.be.at.least(0);
            })
        );

        // .btn-icon-only sets opacity 0.7 (0.5 on hover); the × must render at the token.
        ['', ':hover'].forEach((state) =>
            it(`.or-comment-widget__content__btn-close-x${state} is opaque`, () => {
                const sel = `.or-comment-widget__content__btn-close-x${state}`;
                let last;
                root.walkRules((rule) => {
                    const decl = rule.nodes
                        .filter((n) => n.prop === 'opacity')
                        .pop();
                    if (
                        decl &&
                        rule.selectors.some(
                            (s) =>
                                s.trim() === sel ||
                                s.trim() === `.btn-icon-only${state}`
                        )
                    ) {
                        last = decl.value;
                    }
                });
                expect(last).to.equal('1');
            })
        );

        it('new-query bubbles carry #fa0000 and no #ff8080', () => {
            expect(css).to.not.match(/ff8080/i);
            const rules = [];
            root.walkRules(/\.btn-dn\.new\b|\.icon\.new\b/, (r) => {
                if (/fa0000/i.test(r.toString())) rules.push(r.selector);
            });
            expect(rules.length).to.be.at.least(5);
        });

        // a.btn.btn-default.first-page in the jump-nav, resting, hovered or focused
        const jumpColor = (cls, state) => {
            const bases = [
                '.btn',
                '.btn.btn-default',
                `.form-footer__content__jump-nav ${cls}`,
            ];
            let best;
            root.walkRules((rule) => {
                const decl = rule.nodes.filter((n) => n.prop === 'color').pop();
                if (!decl) return;
                rule.selectors
                    .map((x) => x.trim().replace(/\s+/g, ' '))
                    .forEach((x) => {
                        const m = x.match(/^(.*?)(:hover|:focus)?$/);
                        if (!bases.includes(m[1])) return;
                        if (m[2] && m[2] !== state) return;
                        if (!best || cmp(spec(x), best.spec) >= 0) {
                            best = { spec: spec(x), value: decl.value };
                        }
                    });
            });

            return best && best.value;
        };

        ['.first-page', '.last-page'].forEach((cls) =>
            ['', ':hover', ':focus'].forEach((state) =>
                it(`${cls} jump button${state} uses --oc-jump-nav-text`, () => {
                    expect(jumpColor(cls, state)).to.equal(
                        'var(--oc-jump-nav-text)'
                    );
                })
            )
        );

        it('button hover background and border are #c25700', () => {
            const decl = (selector, prop) => {
                let value;
                root.walkRules((rule) => {
                    if (rule.selectors.some((s) => s.trim() === selector)) {
                        rule.walkDecls(prop, (d) => {
                            value = d.value;
                        });
                    }
                });

                return value;
            };
            expect(decl('.btn:hover', 'background-color')).to.equal('#c25700');
            expect(decl('.btn', 'border-color')).to.equal('#c25700');
        });
    });

    describe('other themes', () => {
        const before = process.env.OC_CSS_BEFORE;
        ['theme-kobo', 'theme-plain'].forEach((theme) => {
            ['css', 'print.css'].forEach((ext) => {
                const file = `${theme}.${ext}`;
                (before ? it : it.skip)(
                    `${file} equals the file in OC_CSS_BEFORE`,
                    () => {
                        const built = fs.readFileSync(
                            path.resolve(__dirname, '../../public/css', file)
                        );
                        expect(
                            built.equals(
                                fs.readFileSync(path.join(before, file))
                            )
                        ).to.equal(true);
                    }
                );
            });
        });
    });
});
