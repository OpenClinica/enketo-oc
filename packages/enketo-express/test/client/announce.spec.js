import i18next from 'i18next';
import announce from '../../public/js/src/module/announce';
import { Form } from '../../public/js/src/module/form-oc';
import gui from '../../public/js/src/module/gui';
import { t } from '../../public/js/src/module/translator';
import '../../public/js/src/module/form-model-oc';
import en from '../../locales/src/en/translation-additions.json';

const range = document.createRange();

describe('Live regions (announce)', () => {
    let regions;

    beforeEach(() => {
        regions = range.createContextualFragment(
            '<div><div id="oc-live-polite" class="oc-visually-hidden" role="status"></div>' +
                '<div id="oc-live-assertive" class="oc-visually-hidden" role="alert"></div></div>'
        ).firstElementChild;
        document.body.append(regions);
    });

    afterEach(() => {
        regions.remove();
    });

    const polite = () => document.querySelector('#oc-live-polite');
    const assertive = () => document.querySelector('#oc-live-assertive');

    it('writes into the polite region by default', () => {
        announce('x');

        expect(polite().textContent).to.equal('x');
        expect(assertive().textContent).to.equal('');
    });

    it('writes into the assertive region with { assertive: true }', () => {
        announce('y', { assertive: true });

        expect(assertive().textContent).to.equal('y');
        expect(polite().textContent).to.equal('');
    });

    it('changes the DOM again for a repeated message', () => {
        announce('same');
        const first = polite().firstChild;
        announce('same');

        expect(polite().textContent).to.equal('same');
        expect(polite().firstChild).not.to.equal(first);
    });

    it('does nothing when the region is missing (headless)', () => {
        regions.remove();

        expect(() => announce('z')).not.to.throw();
        expect(() => announce('z', { assertive: true })).not.to.throw();
    });

    describe('page changes', () => {
        const q = (n) =>
            `<label class="question non-select"><span lang="" class="question-label active">${n}</span>` +
            `<input type="text" name="/data/${n}" data-type-xml="string"></label>`;
        const html = `<form autocomplete="off" novalidate="novalidate" class="or clearfix pages" dir="ltr" data-form-id="pages3">${q(
            'a'
        )}${q('b')}${q('c')}</form>`;
        const model =
            '<model><instance><data id="pages3"><a/><b/><c/><meta><instanceID/></meta></data></instance></model>';
        let wrapper;
        let form;

        before(() => {
            // Karma loads no translations: add the en string so the numbers are checked.
            i18next.addResource(
                i18next.languages[0],
                'translation',
                'form.pages.position',
                en.form.pages.position
            );
        });

        after(() => {
            i18next.removeResourceBundle(i18next.languages[0], 'translation');
        });

        beforeEach(() => {
            wrapper = range.createContextualFragment(
                `<div>${html}</div>`
            ).firstElementChild;
            document.body.append(wrapper);
            form = new Form(wrapper.querySelector('form'), {
                modelStr: model,
            });
            form.init();
        });

        afterEach(() => {
            wrapper.remove();
        });

        it('announces nothing for the first page after load', () => {
            expect(form.pages.active).to.equal(true);
            expect(polite().textContent).to.equal('');
        });

        it('announces "Page 2 of 3" when page 2 of 3 becomes current', () => {
            form.pages._flipTo(form.pages.activePages[1], 1);

            expect(polite().textContent).to.equal('Page 2 of 3');
        });
    });

    describe('offline status', () => {
        let header;

        beforeEach(() => {
            header = range.createContextualFragment(
                '<div class="offline-enabled"><div class="offline-enabled__icon not-enabled"></div>' +
                    '<span class="oc-visually-hidden offline-enabled__status"></span></div>'
            ).firstElementChild;
            document.body.append(header);
        });

        afterEach(() => {
            header.remove();
        });

        const status = () =>
            document.querySelector('.offline-enabled__status').textContent;

        it('sets the hidden status text and announces it only on a change', () => {
            gui.updateStatus.offlineCapable(true);

            expect(status()).to.equal(t('offline.status.enabled'));
            // The first status is not a change.
            expect(polite().textContent).to.equal('');

            gui.updateStatus.offlineCapable(true);
            expect(polite().textContent).to.equal('');

            gui.updateStatus.offlineCapable(false);
            expect(status()).to.equal(t('offline.status.disabled'));
            expect(polite().textContent).to.equal(t('offline.status.disabled'));
        });

        it('has the English strings in the en bundle', () => {
            expect(en.offline.status.enabled).to.equal(
                'This form can be used offline'
            );
            expect(en.offline.status.disabled).to.equal(
                'Offline use is not available'
            );
        });
    });
});
