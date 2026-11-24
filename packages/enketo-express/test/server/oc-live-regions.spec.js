const { expect } = require('chai');
const path = require('path');
const pug = require('pug');
const postcss = require('postcss');

// .oc-visually-hidden comes from the <style> in _skip-link.pug, which webform.pug
// renders in every theme (theme-kobo and theme-plain do not import _oc-a11y.scss).
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

    const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]
        .map((m) => m[1])
        .join('\n');
    let hidden;
    postcss.parse(styles).walkRules((r) => {
        if (r.selectors.includes('.oc-visually-hidden'))
            hidden = decls(r.toString());
    });

    it('the page carries the .oc-visually-hidden rule', () => {
        expect(hidden, '.oc-visually-hidden rule').to.not.equal(undefined);
        expect(hidden.clip).to.equal('rect(0,0,0,0)!important');
    });

    [
        /<div[^>]*id="oc-live-polite"[^>]*>/,
        /<div[^>]*id="oc-live-assertive"[^>]*>/,
        /<span[^>]*offline-enabled__status[^>]*>/,
    ].forEach((re) => {
        it(`${re} carries .oc-visually-hidden`, () => {
            const tag = html.match(re);
            expect(tag, 'element rendered').to.not.equal(null);
            expect(tag[0]).to.match(/class="[^"]*\boc-visually-hidden\b/);
        });
    });
});
