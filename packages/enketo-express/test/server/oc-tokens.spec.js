const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const css = (theme) =>
    fs.readFileSync(
        path.resolve(__dirname, `../../public/css/${theme}.css`),
        'utf8'
    );

// --oc-* custom properties in a built theme: what ships, per theme.
const builtTokens = (theme) => {
    const tokens = {};
    postcss.parse(css(theme)).walkRules(':root', (rule) =>
        rule.walkDecls(/^--oc-/, (d) => {
            tokens[d.prop.slice(5)] = d.value.toLowerCase();
        })
    );

    return tokens;
};

// Expected values per theme. Change a colour in _oc-tokens.scss and here.
const SHARED = {
    'input-border': '#7c7c7c',
    'secondary-text': '#606060',
    error: '#a43f3e',
    focus: '#3882b9',
    'query-new': '#ce5557',
    'query-updated': '#bc6600',
    'icon-muted': '#8a8a8a',
    'jump-nav-text': '#1c1c1c',
};
const EXPECTED = {
    'theme-oc': {
        ...SHARED,
        accent: '#aa3d00',
        'accent-hover': '#c25700',
        'radio-checked': '#bb6605',
    },
    'theme-formhub': {
        ...SHARED,
        accent: '#b13300',
        'accent-hover': '#a53f06',
        'radio-checked': '#dc4b00',
    },
    // Grid keeps its own radio colours, so it has no radio-checked.
    'theme-grid': {
        ...SHARED,
        accent: '#b13300',
        'accent-hover': '#a53f06',
    },
};

// WCAG relative-luminance contrast ratio
const rgb = (hex) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lum = (hex) => {
    const [r, g, b] = rgb(hex).map((c) =>
        c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    );

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
};
// fg drawn at opacity a over bg
const blend = (fg, bg, a) =>
    `#${rgb(fg)
        .map((x, i) => a * x + (1 - a) * rgb(bg)[i])
        .map((v) =>
            Math.round(v * 255)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`;

const WHITE = '#ffffff';
const PAGE = '#f0f0f0';
const DISABLED = '#eeeeee'; // disabled input
const INVALID = '#f2dede'; // invalid question
// strict question: read from the built CSS ($oc-strict-bg in strict-class.scss)
const STRICT = (() => {
    let value;
    postcss
        .parse(css('theme-oc'))
        .walkRules('.alert-box.oc-strict-error', (r) =>
            r.walkDecls('background-color', (d) => {
                value = d.value.toLowerCase();
            })
        );

    return value;
})();
const HOVER = '#fde2cb'; // option hover
const RFC = '#f1f1f1'; // reason-for-change panel
const QUERIES = '#e4e4e4'; // query list
const ALL = [WHITE, PAGE, DISABLED, INVALID, STRICT, HOVER, RFC, QUERIES];

// What each token must pass (WCAG 2.2): text 4.5, graphics 3, on the
// backgrounds it sits on. pairs() gives [foreground, background] pairs.
const on = (bgs) => (c) => bgs.map((bg) => [c, bg]);
const RULES = {
    accent: {
        target: 4.5,
        pairs: on([WHITE, PAGE, INVALID, STRICT, HOVER, DISABLED]),
    },
    'accent-hover': { target: 4.5, pairs: on([WHITE]) },
    'radio-checked': {
        target: 3,
        pairs: on([WHITE, PAGE, INVALID, STRICT, HOVER]),
    },
    'input-border': { target: 3, pairs: on(ALL) },
    'secondary-text': {
        target: 4.5,
        pairs: on([WHITE, PAGE, INVALID, STRICT, DISABLED]),
    },
    error: { target: 4.5, pairs: on([INVALID, STRICT, WHITE]) },
    focus: { target: 3, pairs: on(ALL) },
    'query-new': {
        target: 3,
        pairs: on([WHITE, PAGE, INVALID, STRICT, QUERIES, HOVER]),
    },
    // Updated-query icon: graphic 3:1, same backgrounds as the new-query icon
    'query-updated': {
        target: 3,
        pairs: on([WHITE, PAGE, INVALID, STRICT, QUERIES, HOVER]),
    },
    'icon-muted': { target: 3, pairs: on([WHITE, PAGE]) },
    // Page jump buttons: text and button (#eeeeee, hover #cccccc) at opacity 0.7
    'jump-nav-text': {
        target: 4.5,
        pairs: (c) =>
            [WHITE, PAGE].flatMap((page) =>
                ['#eeeeee', '#cccccc'].map((btn) => [
                    blend(c, page, 0.7),
                    blend(btn, page, 0.7),
                ])
            ),
    },
};
// Buttons put white text on these.
const WHITE_TEXT_ON = ['accent', 'accent-hover'];

describe('OC tokens', () => {
    Object.entries(EXPECTED).forEach(([theme, expected]) =>
        describe(theme, () => {
            const tokens = builtTokens(theme);

            it('every token equals its expected value', () => {
                expect(tokens).to.deep.equal(expected);
            });

            Object.entries(expected).forEach(([name, value]) => {
                it(`${name} has a contrast rule and passes it`, () => {
                    const rule = RULES[name];
                    expect(rule, `RULES entry for ${name}`).to.exist;
                    rule.pairs(value).forEach(([fg, bg]) => {
                        expect(ratio(fg, bg), `${fg} on ${bg}`).to.be.at.least(
                            rule.target
                        );
                    });
                });
            });

            it('white text on accent and accent-hover reaches 4.5', () => {
                WHITE_TEXT_ON.forEach((name) => {
                    expect(ratio(WHITE, expected[name]), name).to.be.at.least(
                        4.5
                    );
                });
            });

            it('button hover background and border use accent-hover', () => {
                const root = postcss.parse(css(theme));
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
                expect(decl('.btn:hover', 'background-color')).to.equal(
                    expected['accent-hover']
                );
                expect(decl('.btn', 'border-color')).to.equal(
                    expected['accent-hover']
                );
            });
        })
    );

    describe('built theme-oc.css, remaining colour rows', () => {
        const ocCss = css('theme-oc');
        const root = postcss.parse(ocCss);
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

        it('new-query bubbles carry query-new and no master #ff8080', () => {
            const hex = EXPECTED['theme-oc']['query-new'].slice(1);
            expect(ocCss).to.not.match(/ff8080/i);
            const rules = [];
            // SVG data URIs hold the colour URL-encoded (%23ce5557)
            root.walkRules(/\.btn-dn\.new\b|\.icon\.new\b/, (r) => {
                if (new RegExp(hex, 'i').test(r.toString()))
                    rules.push(r.selector);
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
    });

    describe('colour rules in the compiled themes', () => {
        const THEMES = ['theme-oc', 'theme-formhub', 'theme-grid'];
        const norm = (s) => s.trim().replace(/\s+/g, ' ');
        // Value of prop in the last rule (source order) that lists the exact selector
        const lastDecl = (root, selector, prop) => {
            let value;
            root.walkRules((rule) => {
                if (!rule.selectors.some((s) => norm(s) === selector)) return;
                const d = rule.nodes.filter((n) => n.prop === prop).pop();
                if (d) value = d.value.toLowerCase();
            });

            return value;
        };

        THEMES.forEach((theme) =>
            describe(theme, () => {
                const text = css(theme);
                const root = postcss.parse(text);
                const tok = EXPECTED[theme];

                // The icons are SVG data URIs, which cannot use var(): the hex is URL-encoded.
                // The master rules stay in the file; ours come later and must win.
                [
                    '.btn-comment.btn-dn.updated .icon',
                    '.btn-comment.btn-dn.updated.annotation .icon',
                    '.btn-comment.btn-dn.updated.multi .icon',
                    '.btn-comment.btn-dn.updated.annotation.multi .icon',
                    '.or-comment-widget__nav__item__start .icon.updated',
                ].forEach((sel) =>
                    it(`${sel} icon carries query-updated`, () => {
                        const img = lastDecl(root, sel, 'background-image');
                        expect(img).to.match(
                            new RegExp(tok['query-updated'].slice(1), 'i')
                        );
                        expect(img).to.not.match(/ffa500/i);
                    })
                );

                // Set through $input-color-placeholder in _oc-token-variables.scss
                it('every placeholder uses secondary-text', () => {
                    let n = 0;
                    root.walkRules(/placeholder/, (rule) => {
                        rule.walkDecls('color', (d) => {
                            n += 1;
                            expect(
                                [
                                    'var(--oc-secondary-text)',
                                    tok['secondary-text'],
                                ],
                                rule.selector
                            ).to.include(d.value.toLowerCase());
                        });
                    });
                    expect(n).to.be.at.least(10);
                });

                it('.btn-icon-only rest and hover reach 3:1 on every background', () => {
                    const color = (s) => lastDecl(root, s, 'color');
                    const opacity = (s) => Number(lastDecl(root, s, 'opacity'));
                    [
                        ['.btn-icon-only', opacity('.btn-icon-only')],
                        [
                            '.btn-icon-only:hover',
                            opacity('.btn-icon-only:hover'),
                        ],
                    ].forEach(([s, a]) => {
                        expect(color(s), s).to.match(/^#[0-9a-f]{6}$/);
                        ALL.forEach((bg) =>
                            expect(
                                ratio(blend(color(s), bg, a), bg),
                                `${s} on ${bg}`
                            ).to.be.at.least(3)
                        );
                    });
                    expect(opacity('.btn-icon-only:hover')).to.equal(1);
                });

                [
                    '.reason-for-change__header__apply-to-all.question input[type=text]',
                    '.touch .question.simple-select .option-wrapper > label',
                ].forEach((sel) =>
                    it(`${sel} border uses input-border`, () => {
                        expect(lastDecl(root, sel, 'border')).to.equal(
                            '1px solid var(--oc-input-border)'
                        );
                    })
                );

                it('offline queue submitting uses accent', () => {
                    expect(
                        lastDecl(
                            root,
                            '.offline-enabled .offline-enabled__queue-length.submitting',
                            'color'
                        )
                    ).to.equal('var(--oc-accent)');
                });

                it('the geopicker text button uses secondary-text', () => {
                    expect(
                        lastDecl(
                            root,
                            '.geopicker .toggle-input-type-btn',
                            'color'
                        )
                    ).to.equal('var(--oc-secondary-text)');
                });

                it('query history meta uses secondary-text', () => {
                    expect(
                        lastDecl(
                            root,
                            '.or-comment-widget__content__history__row__main__comment__meta',
                            'color'
                        )
                    ).to.equal('var(--oc-secondary-text)');
                });
            })
        );
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
