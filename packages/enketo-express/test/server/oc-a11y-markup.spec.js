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
