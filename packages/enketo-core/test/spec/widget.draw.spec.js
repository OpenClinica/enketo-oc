import DrawWidget from '../../src/widget/draw/draw-widget';
import { runAllCommonWidgetTests } from '../helpers/test-widget';

const FORM1 = `<form class="or">
        <label class="question or-appearance-draw">
            <input name="/data/d" type="file" data-type-xml="binary" accept="image/*" />
        </label>
        <input />
    </form>`;
const FORM2 = `<form class="or">
        <label class="question or-appearance-signature">
            <input name="/data/s" type="file" data-type-xml="binary" accept="image/*" />
        </label>
        <input />
    </form>`;
const FORM3 = `<form class="or">
        <label class="question or-appearance-annotate">
            <input name="/data/a" type="file" data-type-xml="binary" accept="image/*" />
        </label>
        <input />
    </form>`;

[FORM1, FORM2, FORM3].forEach((form) => {
    runAllCommonWidgetTests(DrawWidget, form, '');
});

describe('draw widget', () => {
    it('does not instantiate for non image accept attributes', () => {
        const form = FORM1.replace(
            'accept="image/*"',
            'accept="something/else"'
        );
        const fragment = document.createRange().createContextualFragment(form);
        const control = fragment.querySelector(DrawWidget.selector);
        expect(control).to.equal(null);
    });

    it('names the canvas from the question label and a hidden status', () => {
        const form = FORM2.replace(
            '<input name="/data/s"',
            '<span class="question-label active">Sign here</span><input name="/data/s"'
        );
        const fragment = document.createRange().createContextualFragment(form);
        document.body.append(fragment);
        const control = document.querySelector(DrawWidget.selector);
        const widget = new DrawWidget(control);
        const canvas = document.querySelector('.draw-widget__body__canvas');
        const [labelId, statusId] = canvas
            .getAttribute('aria-labelledby')
            .split(' ');
        expect(canvas.getAttribute('role')).to.equal('img');
        expect(document.getElementById(labelId).textContent).to.equal(
            'Sign here'
        );
        expect(document.getElementById(statusId).textContent).to.equal(
            'No signature'
        );
        widget.cache = 'data:image/png;base64,AAAA';
        widget._updateStatus();
        expect(document.getElementById(statusId).textContent).to.equal(
            'Signature: drawn'
        );
        document.querySelector('form.or').remove();
    });
});
