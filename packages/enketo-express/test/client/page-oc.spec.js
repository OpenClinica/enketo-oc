import { Form } from '../../public/js/src/module/form-oc';
import '../../public/js/src/module/form-model-oc';

// Two questions on a paged form: two pages.
const loadPagedForm = () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML =
        '<form class="or pages" data-form-id="paged">' +
        '<label class="question"><input type="text" name="/data/a" data-type-xml="string"></label>' +
        '<label class="question"><input type="text" name="/data/b" data-type-xml="string"></label>' +
        '</form>' +
        '<section class="form-footer">' +
        '<button type="button" class="btn first-page disabled"></button>' +
        '<button type="button" class="btn previous-page disabled"></button>' +
        '<button type="button" class="btn next-page disabled"></button>' +
        '<button type="button" class="btn last-page disabled"></button>' +
        '</section>';
    const form = new Form(wrapper.querySelector('form'), {
        modelStr:
            '<model><instance><data id="paged"><a/><b/><meta><instanceID/></meta></data></instance></model>',
    });
    form.init();

    return { form, footer: wrapper.querySelector('.form-footer') };
};

describe('OC page buttons', () => {
    it('mirror the disabled class in aria-disabled and set no disabled property', () => {
        const { form, footer } = loadPagedForm();
        const btn = (c) => footer.querySelector(`.${c}`);
        const check = () =>
            ['first-page', 'previous-page', 'next-page', 'last-page'].forEach(
                (c) => {
                    const el = btn(c);
                    expect(el.disabled, c).to.equal(false);
                    expect(el.getAttribute('aria-disabled'), c).to.equal(
                        el.classList.contains('disabled') ? 'true' : null
                    );
                }
            );

        expect(form.pages.activePages.length).to.equal(2);

        // first page: first and previous disabled, next and last enabled
        check();
        expect(btn('previous-page').getAttribute('aria-disabled')).to.equal(
            'true'
        );
        expect(btn('next-page').hasAttribute('aria-disabled')).to.equal(false);

        form.pages._toggleButtons(1);
        check();
        expect(btn('next-page').getAttribute('aria-disabled')).to.equal('true');
        expect(btn('previous-page').hasAttribute('aria-disabled')).to.equal(
            false
        );
    });
});
