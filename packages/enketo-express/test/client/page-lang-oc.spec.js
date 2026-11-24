import { setPageLang } from '../../public/js/src/module/page-lang-oc';
import { localize } from '../../public/js/src/module/translator';

describe('Page language', () => {
    const html = document.documentElement;
    let before;
    beforeEach(() => {
        before = html.lang;
        html.lang = 'en';
    });
    afterEach(() => {
        html.lang = before;
    });

    it('follows a language code, with or without a region', () => {
        setPageLang('de');
        expect(html.lang).to.equal('de');
        setPageLang('pt-BR');
        expect(html.lang).to.equal('pt-BR');
    });

    it('ignores `default`, a language name and an empty value', () => {
        ['default', 'English', '', undefined].forEach((lng) => {
            setPageLang(lng);
            expect(html.lang, String(lng)).to.equal('en');
        });
    });

    it('is not changed by the shared translator', async () => {
        await localize(document.createElement('div'), 'de');
        expect(html.lang).to.equal('en');
        await localize(document.createElement('div'), 'en');
    });
});
