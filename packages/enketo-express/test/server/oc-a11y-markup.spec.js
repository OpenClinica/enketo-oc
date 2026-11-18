const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const pug = require('pug');
const postcss = require('postcss');

const viewsDir = path.resolve(__dirname, '../../app/views');
const locals = {
    t: (key) => key,
    dir: () => 'ltr',
    language: 'en',
    basePath: '',
    offlinePath: '',
    logo: {},
    headless: false,
};
const render = (file, extra = {}) =>
    pug.renderFile(path.resolve(viewsDir, file), Object.assign({}, locals, extra));

const tagOf = (html, re) => {
    const m = html.match(re);
    expect(m, `element matching ${re}`).to.not.equal(null);

    return m[0];
};

describe('Print and close buttons have a type and an accessible name', () => {
    it('Print button is type=button and named', () => {
        const tag = tagOf(
            render('surveys/component/_form-header.pug'),
            /<button[^>]*form-header__button--print[^>]*>/
        );
        expect(tag).to.match(/type="button"/);
        expect(tag).to.match(/aria-label="form\.print"/);
        expect(tag).to.match(/onclick="return false;"/);
    });

    it('feedback-bar close is type=button and named', () => {
        const tag = tagOf(
            render('surveys/component/_feedback-bar.pug'),
            /<button[^>]*class="[^"]*\bclose\b[^"]*"[^>]*>/
        );
        expect(tag).to.match(/type="button"/);
        expect(tag).to.match(/aria-label="alert\.close"/);
    });

    it('side-slider close is named and not aria-hidden', () => {
        const tag = tagOf(
            render('surveys/component/_side-slider.pug'),
            /<button[^>]*class="[^"]*\bclose\b[^"]*"[^>]*>/
        );
        expect(tag).to.match(/aria-label="alert\.close"/);
        expect(tag).to.not.match(/aria-hidden/);
    });
});

describe('Skip link to the form', () => {
    it('renders a link to #form-title', () => {
        const html = render('surveys/component/_skip-link.pug');
        expect(html).to.match(
            /<a class="oc-skip-link" href="#form-title">form\.skiplink<\/a>/
        );
    });

    it('renders nothing when headless', () => {
        const html = render('surveys/component/_skip-link.pug', {
            headless: true,
        });
        expect(html.trim()).to.equal('');
    });

    // The partial carries its own style: theme-kobo and theme-plain do not
    // import _oc-a11y.scss, so a rule there would leave the link visible.
    describe('its inline style', () => {
        let ast;
        let visuallyHidden;
        before(() => {
            const html = render('surveys/component/_skip-link.pug');
            const m = html.match(/<style>([\s\S]*?)<\/style>/);
            ast = postcss.parse(m ? m[1] : '');
        });

        const decls = (rule) => {
            const out = {};
            rule.walkDecls((d) => {
                out[d.prop] = `${d.value.replace(/\s+/g, '')}${
                    d.important ? '!important' : ''
                }`;
            });

            return out;
        };

        const scss = fs.readFileSync(
            path.resolve(viewsDir, 'styles/component/_oc-a11y.scss'),
            'utf8'
        );
        before(() => {
            visuallyHidden = postcss.parse(
                scss.match(/\.oc-visually-hidden \{[^}]*\}/)[0]
            ).first;
        });

        const selectorRule = (selector) => {
            let found = null;
            ast.walkRules((r) => {
                if (r.selector === selector) found = r;
            });
            expect(found, `rule ${selector}`).to.not.equal(null);

            return found;
        };

        it('hides the link with the .oc-visually-hidden declarations until focused', () => {
            expect(decls(selectorRule('.oc-skip-link:not(:focus)'))).to.deep.equal(
                decls(visuallyHidden)
            );
        });

        it('shows the link at the top of the page on focus', () => {
            const focus = decls(selectorRule('.oc-skip-link:focus'));
            expect(focus.position).to.equal('absolute');
            expect(focus.top).to.equal('0');
        });
    });

    it('webform.pug includes it as the first line of block content', () => {
        const src = fs.readFileSync(
            path.resolve(viewsDir, 'surveys/webform.pug'),
            'utf8'
        );
        expect(src).to.match(
            /^block content\n  include component\/_skip-link\n/m
        );
    });
});

describe('Form footer page controls are buttons in visual Tab order', () => {
    const footer = (extra) =>
        render('surveys/component/_form-footer.pug', extra);
    const keyOf = (tag) =>
        [
            'previous-page',
            'next-page',
            'exit-form',
            'close-form',
            'complete-form',
            'save-draft',
            'submit-form',
            'validate-form',
        ].find((k) => new RegExp(`\\b${k}\\b`).test(tag));
    const mainOrder = (html) =>
        (html.match(/<button[^>]*>/g) || [])
            .filter((t) => !/first-page|last-page/.test(t))
            .map(keyOf);

    // order values and `~` rules of _common-oc.scss: previous 1, middle 2,
    // next 3, `#close-form ~ #complete-form` and `#exit-form ~ #close-form` 4.
    const variants = [
        [
            'participant',
            { type: 'fieldsubmission', participant: true },
            ['previous-page', 'exit-form', 'next-page', 'close-form'],
        ],
        [
            'participant with Complete',
            { type: 'fieldsubmission', participant: true, completeButton: true },
            [
                'previous-page',
                'exit-form',
                'next-page',
                'close-form',
                'complete-form',
            ],
        ],
        [
            'Close and Complete',
            { type: 'view', closeButton: true, completeButton: true },
            ['previous-page', 'close-form', 'next-page', 'complete-form'],
        ],
        [
            'Complete only',
            { type: 'view', completeButton: true },
            ['previous-page', 'complete-form', 'next-page'],
        ],
        [
            'Close only',
            { type: 'view', closeButton: true },
            ['previous-page', 'close-form', 'next-page'],
        ],
        [
            'preview',
            { type: 'preview' },
            ['previous-page', 'validate-form', 'next-page'],
        ],
        [
            'full',
            { type: 'full' },
            ['previous-page', 'submit-form', 'next-page'],
        ],
        [
            'full with Save Draft',
            { type: 'full', draftEnabled: true, offlinePath: '/x' },
            ['previous-page', 'save-draft', 'submit-form', 'next-page'],
        ],
    ];

    variants.forEach(([name, extra, expected]) => {
        it(`${name}: DOM order equals visual order`, () => {
            expect(mainOrder(footer(extra))).to.deep.equal(expected);
        });

        it(`${name}: sibling selectors still match`, () => {
            const o = mainOrder(footer(extra));
            if (o.includes('exit-form') && o.includes('close-form')) {
                expect(o.indexOf('exit-form')).to.be.below(
                    o.indexOf('close-form')
                );
            }
            if (o.includes('close-form') && o.includes('complete-form')) {
                expect(o.indexOf('close-form')).to.be.below(
                    o.indexOf('complete-form')
                );
            }
        });
    });

    it('the four page controls are type=button buttons with the same classes', () => {
        const html = footer({ type: 'view', closeButton: true });
        [
            ['btn btn-primary next-page', /class="btn btn-primary next-page"/],
            [
                'previous',
                /class="btn btn-default previous-page disabled"/,
            ],
            [
                'first',
                /class="btn btn-default disabled first-page"/,
            ],
            ['last', /class="btn btn-default disabled last-page"/],
        ].forEach(([, re]) => {
            const tag = tagOf(html, new RegExp(`<button[^>]*${re.source}[^>]*>`));
            expect(tag).to.match(/type="button"/);
        });
        expect(html).to.not.match(/<a[^>]*(next|previous|first|last)-page/);
    });
});
