const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const pug = require('pug');
const postcss = require('postcss');

// theme-kobo and theme-plain do not carry .oc-visually-hidden, so the hidden
// elements must be hidden by their inline style alone.
describe('Live regions and offline status are visually hidden in every theme', () => {
    const html = pug.renderFile(
        path.resolve(__dirname, '../../app/views/surveys/webform.pug'),
        {
            t: (key) => key,
            dir: () => 'ltr',
            language: 'en',
            basePath: '',
            offlinePath: '/x',
            defaultTheme: 'kobo',
            print: false,
            type: 'full',
            headless: false,
            clientConfig: {},
            form: '<form></form>',
            logo: {},
        }
    );

    const decls = (css) => {
        const out = {};
        postcss.parse(css).walkDecls((d) => {
            out[d.prop] = `${d.value.replace(/\s+/g, '')}${
                d.important ? '!important' : ''
            }`;
        });

        return out;
    };

    const scss = fs.readFileSync(
        path.resolve(
            __dirname,
            '../../app/views/styles/component/_oc-a11y.scss'
        ),
        'utf8'
    );
    const rule = decls(scss.match(/\.oc-visually-hidden \{[^}]*\}/)[0]);

    [
        /<div[^>]*id="oc-live-polite"[^>]*>/,
        /<div[^>]*id="oc-live-assertive"[^>]*>/,
        /<span[^>]*offline-enabled__status[^>]*>/,
    ].forEach((re) => {
        it(`${re} has an inline style equal to the .oc-visually-hidden rule`, () => {
            const tag = html.match(re);
            expect(tag, 'element rendered').to.not.equal(null);
            const style = tag[0].match(/style="([^"]*)"/);
            expect(style, 'inline style').to.not.equal(null);
            expect(decls(`a{${style[1]}}`)).to.deep.equal(rule);
            expect(rule.clip).to.equal('rect(0,0,0,0)!important');
        });
    });
});
