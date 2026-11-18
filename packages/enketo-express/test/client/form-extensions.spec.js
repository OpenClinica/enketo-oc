import i18next from 'i18next';
import { Form } from '../../public/js/src/module/form-oc';
import en from '../../locales/src/en/translation-additions.json';
import forms from './forms/forms';
import '../../public/js/src/module/form-model-oc';

const range = document.createRange();

const loadForm = (filename) => {
    const strings = forms[filename];
    const formEl = range
        .createContextualFragment(`<div>${strings.html_form}</div>`)
        .querySelector('form');

    return new Form(formEl, {
        modelStr: strings.xml_model,
    });
};

describe('Extended Form Class', () => {
    let form;

    beforeEach(() => {
        form = loadForm('relevant_constraint_required.xml');
        form.init();
    });

    // Test if the Form class has been extended
    // There have been issues in the passed where the loading order in karma.conf.js was changed
    // and the ESBuild config was changed that silently broke OpenClinica's extensions.
    it('has a custom property to indicate extensions were added successfully', () => {
        expect(form.extendedBy).to.equal('OpenClinica');
    });

    it('has multiple additions to the evaluation cascade', () => {
        expect(form.evaluationCascadeAdditions.length).to.equal(2);
    });

    it('so that Form instance has multiple invalid constraint classes', () => {
        expect(form.constraintClassesInvalid.length).to.be.above(1);
    });

    it('so that Form prototype has multiple invalid constraint classes', () => {
        expect(Form.prototype.constraintClassesInvalid.length).to.be.above(1);
    });
});

describe('OC-27867: goToTarget on field-list radio/checkbox page flip', () => {
    let form;
    let fieldListGroup;
    let radioInput;

    beforeEach(() => {
        form = loadForm('field_list_radio.xml');
        form.init();

        // .focus() is a no-op on elements not attached to the document, so the
        // form must be in the live DOM for these assertions to be meaningful.
        document.body.appendChild(form.view.html);

        fieldListGroup = form.view.html.querySelector(
            '*[name="/field_list_radio/group1"]'
        );
        radioInput = form.view.html.querySelector(
            'input[name="/field_list_radio/group1/radio_field"]'
        );
    });

    afterEach(() => {
        form.view.html.remove();
    });

    it('does not focus the radio when flipping to its field-list page', () => {
        form.goToTarget(fieldListGroup, { isPageFlip: true });

        expect(document.activeElement).to.not.equal(radioInput);
    });

    it('still dispatches applyfocus, so other widgets keep working', () => {
        let applyfocusFired = false;
        radioInput.addEventListener('applyfocus', () => {
            applyfocusFired = true;
        });

        form.goToTarget(fieldListGroup, { isPageFlip: true });

        expect(applyfocusFired).to.equal(true);
    });

    it('still focuses the radio when it is not a page flip (e.g. jumping to a validation error)', () => {
        form.goToTarget(fieldListGroup);

        expect(document.activeElement).to.equal(radioInput);
    });
});

describe('Errors tied to their field and announced', () => {
    // One field-list page with two required questions; "a" also has a constraint.
    const q = (n, extra = '') =>
        `<label class="question non-select"><span lang="" class="question-label active">${n}</span>` +
        `<input type="text" name="/data/g/${n}" data-type-xml="string" data-required="true()"${extra}>` +
        `<span class="or-required-msg active" lang="">This field is required</span>` +
        `<span class="or-constraint-msg active" lang="">Value not allowed</span></label>`;
    const html =
        '<form autocomplete="off" novalidate="novalidate" class="or clearfix pages" dir="ltr" data-form-id="err">' +
        `<section class="or-group or-appearance-field-list" name="/data/g">${q(
            'a',
            ' data-constraint=". = \'x\'" aria-describedby="hint-a"'
        )}${q('b')}</section></form>`;
    const model =
        '<model><instance><data id="err"><g><a/><b/></g><meta><instanceID/></meta></data></instance></model>';
    let wrapper;
    let regions;
    let form;
    let a;

    const assertive = () => document.querySelector('#oc-live-assertive');
    const question = (el) => el.closest('.question');
    const msg = (el, type) => question(el).querySelector(`.or-${type}-msg`);

    before(() => {
        // Karma loads no translations: add the en strings so the count text is checked.
        const lng = i18next.languages[0];
        i18next.addResource(
            lng,
            'translation',
            'constraint.attention',
            en.constraint.attention
        );
        i18next.addResource(
            lng,
            'translation',
            'constraint.attention_plural',
            en.constraint.attention_plural
        );
    });

    after(() => {
        const constraint = i18next.getResource(
            i18next.languages[0],
            'translation',
            'constraint'
        );
        delete constraint.attention;
        delete constraint.attention_plural;
    });

    beforeEach(() => {
        regions = range.createContextualFragment(
            '<div><div id="oc-live-polite" role="status"></div><div id="oc-live-assertive" role="alert"></div></div>'
        ).firstElementChild;
        wrapper = range.createContextualFragment(
            `<div>${html}</div>`
        ).firstElementChild;
        document.body.append(regions, wrapper);
        form = new Form(wrapper.querySelector('form'), { modelStr: model });
        form.init();
        a = wrapper.querySelector('input[name="/data/g/a"]');
    });

    afterEach(() => {
        wrapper.remove();
        regions.remove();
    });

    it('setInvalid marks the control aria-invalid="true" and describes it by the active message', () => {
        form.setInvalid(a, 'required');
        const { id } = msg(a, 'required');

        expect(a.getAttribute('aria-invalid')).to.equal('true');
        expect(id).to.match(/^oc-msg-\d+$/);
        expect(a.getAttribute('aria-describedby').split(' ')).to.include(id);

        // the id is generated once per message element
        form.setInvalid(a, 'required');
        expect(msg(a, 'required').id).to.equal(id);
        expect(
            a
                .getAttribute('aria-describedby')
                .split(' ')
                .filter((t) => t === id).length
        ).to.equal(1);
    });

    it('setValid removes both when no invalid class is left on the question', () => {
        form.setInvalid(a, 'required');
        form.setInvalid(a, 'constraint');
        form.setValid(a, 'required');

        // constraint is still invalid: only its message describes the control
        expect(a.getAttribute('aria-invalid')).to.equal('true');
        expect(a.getAttribute('aria-describedby').split(' ')).to.deep.equal([
            'hint-a',
            msg(a, 'constraint').id,
        ]);

        form.setValid(a, 'constraint');
        expect(a.hasAttribute('aria-invalid')).to.equal(false);
        expect(a.getAttribute('aria-describedby')).to.equal('hint-a');

        const b = wrapper.querySelector('input[name="/data/g/b"]');
        form.setInvalid(b, 'required');
        form.setValid(b);
        expect(b.hasAttribute('aria-invalid')).to.equal(false);
        expect(b.hasAttribute('aria-describedby')).to.equal(false);
    });

    it('removes both when a relevant error is cleared by the branch becoming relevant', () => {
        // enketo-core enable() removes invalid-relevant directly, not through setValid.
        const wrap = question(a);
        wrap.insertAdjacentHTML(
            'beforeend',
            '<span class="or-relevant-msg active" lang="">This value should be cleared</span>'
        );
        form.setInvalid(a, 'relevant');
        expect(a.getAttribute('aria-invalid')).to.equal('true');

        form.relevant.enable(wrap, '/data/g/a');

        expect(wrap.classList.contains('invalid-relevant')).to.equal(false);
        expect(a.hasAttribute('aria-invalid')).to.equal(false);
        expect(a.getAttribute('aria-describedby')).to.equal('hint-a');
    });

    it('an existing aria-describedby value of the control is kept', () => {
        form.setInvalid(a, 'constraint');

        expect(a.getAttribute('aria-describedby').split(' ')).to.deep.equal([
            'hint-a',
            msg(a, 'constraint').id,
        ]);
    });

    it('setInvalid and setValid still add and remove the same classes as before', () => {
        const before = [...question(a).classList];
        const cls = () => [...question(a).classList];

        form.setInvalid(a, 'required');
        form.setInvalid(a, 'constraint');
        expect(cls()).to.deep.equal(
            before.concat('invalid-required', 'invalid-constraint')
        );
        form.setValid(a, 'required');
        expect(cls()).to.deep.equal(before.concat('invalid-constraint'));
        form.setValid(a);
        expect(cls()).to.deep.equal(before);
    });

    it('a failed validation announces "2 questions need attention" once, assertive', async () => {
        let additions = 0;
        const observer = new MutationObserver((records) => {
            records.forEach((r) => {
                additions += r.addedNodes.length;
            });
        });
        observer.observe(assertive(), { childList: true });

        // Page "next" path: wait for the validation that _next starts.
        const { validateContent } = form;
        let validation;
        form.validateContent = function (...args) {
            validation = validateContent.apply(this, args);

            return validation;
        };
        form.pages._next();
        const valid = await validation;
        await new Promise((resolve) => setTimeout(resolve));
        observer.disconnect();

        expect(valid).to.equal(false);
        expect(assertive().textContent).to.equal('2 questions need attention');
        expect(additions).to.equal(1);
        expect(document.querySelector('#oc-live-polite').textContent).to.equal(
            ''
        );
    });

    it('uses the singular for one question and announces nothing without errors', () => {
        form.setInvalid(a, 'required');
        form.announceInvalid(question(a));
        expect(assertive().textContent).to.equal('1 question needs attention');

        assertive().textContent = '';
        form.setValid(a);
        form.announceInvalid();
        expect(assertive().textContent).to.equal('');
    });

    it('no announcement while typing in a field', async () => {
        const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
        a.value = 'y';
        a.dispatchEvent(new Event('change', { bubbles: true }));
        await settle();
        a.value = '';
        a.dispatchEvent(new Event('change', { bubbles: true }));
        await settle();

        expect(question(a).matches('.invalid-required')).to.equal(true);
        expect(assertive().textContent).to.equal('');
    });

    it('has the English strings in the en bundle', () => {
        expect(en.constraint.attention).to.equal(
            '__count__ question needs attention'
        );
        expect(en.constraint.attention_plural).to.equal(
            '__count__ questions need attention'
        );
    });
});
