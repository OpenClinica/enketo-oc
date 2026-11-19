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
});

describe('draw widget accessible names', () => {
    const SIGNATURE_FORM = `<form class="or">
        <label class="question or-appearance-signature">
            <span lang="en" class="question-label active">Sign here</span>
            <span lang="nl" class="question-label">Teken hier</span>
            <input name="/data/s" type="file" data-type-xml="binary" accept="image/*" />
        </label>
    </form>`;
    let sandbox;
    let formEl;

    const tick = () =>
        new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

    const create = async (form = SIGNATURE_FORM) => {
        formEl = document
            .createRange()
            .createContextualFragment(form)
            .querySelector('form');
        document.body.append(formEl);
        const widget = new DrawWidget(
            formEl.querySelector(DrawWidget.selector)
        );
        await widget.initialize;
        await tick();

        return widget;
    };
    const canvasOf = (widget) =>
        widget.question.querySelector('.draw-widget__body__canvas');
    const resetOf = (widget) => widget.question.querySelector('.btn-reset');
    const draw = (widget) => {
        widget.pad.fromData([
            [
                { x: 10, y: 10, time: 1, color: 'black' },
                { x: 20, y: 20, time: 2, color: 'black' },
            ],
        ]);
        widget._updateValue();
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
        formEl.remove();
    });

    it('the canvas has role="img" and the name "Sign here. No signature" when empty', async () => {
        const widget = await create();
        const canvas = canvasOf(widget);
        expect(canvas.getAttribute('role')).to.equal('img');
        expect(canvas.getAttribute('aria-label')).to.equal(
            'Sign here. No signature'
        );
    });

    it('the name changes to "Sign here. Signature: drawn" after a value is set', async () => {
        const widget = await create();
        draw(widget);
        expect(canvasOf(widget).getAttribute('aria-label')).to.equal(
            'Sign here. Signature: drawn'
        );
    });

    it('the name returns to "No signature" after a confirmed reset', async () => {
        sandbox.stub(window, 'confirm').returns(true);
        const widget = await create();
        draw(widget);
        resetOf(widget).click();
        await tick();
        expect(canvasOf(widget).getAttribute('aria-label')).to.equal(
            'Sign here. No signature'
        );
    });

    it('the name is "Sign here. Signature: drawn" for a signature loaded with the record', async () => {
        sandbox.stub(DrawWidget.prototype, '_loadFileIntoPad').resolves('');
        const widget = await create(
            SIGNATURE_FORM.replace(
                'name="/data/s"',
                'name="/data/s" data-loaded-file-name="sig.png"'
            )
        );
        expect(widget.element.value).to.equal('sig.png');
        expect(canvasOf(widget).getAttribute('aria-label')).to.equal(
            'Sign here. Signature: drawn'
        );
    });

    it('the name follows the active language label', async () => {
        const widget = await create();
        const [en, nl] = widget.question.querySelectorAll('.question-label');
        en.classList.remove('active');
        nl.classList.add('active');
        // enketo-core calls update() on every widget on the form "changelanguage" event
        widget.update();
        expect(canvasOf(widget).getAttribute('aria-label')).to.equal(
            'Teken hier. No signature'
        );
    });

    it('the reset button is named "Clear signature", enabled and focusable when the widget is enabled', async () => {
        const widget = await create();
        const reset = resetOf(widget);
        expect(reset.getAttribute('aria-label')).to.equal('Clear signature');
        expect(reset.disabled).to.equal(false);
        reset.focus();
        expect(document.activeElement).to.equal(reset);
    });

    it('reset is a native button; activation calls _reset once', async () => {
        const spy = sandbox.spy(DrawWidget.prototype, '_reset');
        const widget = await create();
        const reset = resetOf(widget);
        // A native <button type="button">: Enter and Space activate it as a click.
        expect(reset.nodeName).to.equal('BUTTON');
        expect(reset.type).to.equal('button');
        reset.click();
        expect(spy.callCount).to.equal(1);
    });

    it('the stored value after drawing and after reset is the same as before this change', async () => {
        sandbox.stub(window, 'confirm').returns(true);
        const widget = await create();
        expect(widget.element.value).to.equal('');
        draw(widget);
        expect(widget.element.value).to.equal('signature.png');
        expect(widget.value.indexOf('data:image/png')).to.equal(0);
        resetOf(widget).click();
        await tick();
        expect(widget.element.value).to.equal('');
        expect(widget.value).to.equal('');
    });

    [
        ['draw', 'Clear drawing'],
        ['annotate', 'Clear file and drawing'],
    ].forEach(([appearance, name]) => {
        it(`${appearance} widgets keep their current markup except the reset name`, async () => {
            const widget = await create(
                SIGNATURE_FORM.replace(
                    'or-appearance-signature',
                    `or-appearance-${appearance}`
                )
            );
            const canvas = canvasOf(widget);
            expect(canvas.hasAttribute('role')).to.equal(false);
            expect(canvas.hasAttribute('aria-label')).to.equal(false);
            expect(canvas.getAttribute('tabindex')).to.equal('0');
            expect(resetOf(widget).getAttribute('aria-label')).to.equal(name);
        });
    });
});
