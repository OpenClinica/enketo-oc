import { Form } from '../../public/js/src/module/form-oc';
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
