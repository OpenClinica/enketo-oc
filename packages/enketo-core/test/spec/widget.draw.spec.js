import { t } from 'enketo/translator';
import dialog from 'enketo/dialog';
import DrawWidget from '../../src/widget/draw/draw-widget';
import support from '../../src/js/support';
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

    it('the Clear confirm puts Cancel first (negFirst)', async () => {
        const confirm = sandbox.stub(dialog, 'confirm').resolves(false);
        const widget = await create();
        draw(widget);
        resetOf(widget).click();
        await tick();
        expect(confirm.calledOnce).to.equal(true);
        expect(confirm.firstCall.args[1]).to.deep.equal({ negFirst: true });
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
        const asAppearance = () =>
            SIGNATURE_FORM.replace(
                'or-appearance-signature',
                `or-appearance-${appearance}`
            );

        it(`${appearance} canvas has role="img" and a name with the label and the state`, async () => {
            const widget = await create(asAppearance());
            const canvas = canvasOf(widget);
            expect(canvas.getAttribute('role')).to.equal('img');
            expect(canvas.getAttribute('tabindex')).to.equal('0');
            expect(canvas.getAttribute('aria-label')).to.equal(
                `Sign here. ${t('drawwidget.state.blank')}`
            );
            expect(resetOf(widget).getAttribute('aria-label')).to.equal(name);
            draw(widget);
            expect(canvas.getAttribute('aria-label')).to.equal(
                `Sign here. ${t('drawwidget.state.drawn')}`
            );
        });

        it(`${appearance} canvas in a repeat instance added after load gets the same name`, async () => {
            const widget = await create(
                `<form class="or"><section class="or-repeat">${asAppearance()
                    .replace('<form class="or">', '')
                    .replace('</form>', '')}</section></form>`
            );
            const clone = widget.question.closest('.or-repeat').cloneNode(true);
            clone.querySelector('.widget').remove();
            clone.querySelector('input').removeAttribute('data-drawing');
            clone.querySelector('input').type = 'file';
            formEl.append(clone);
            const second = new DrawWidget(
                clone.querySelector(DrawWidget.selector)
            );
            await second.initialize;
            await tick();
            expect(canvasOf(second).getAttribute('role')).to.equal('img');
            expect(canvasOf(second).getAttribute('aria-label')).to.equal(
                `Sign here. ${t('drawwidget.state.blank')}`
            );
            expect(resetOf(second).getAttribute('aria-label')).to.equal(name);
        });
    });

    describe('colour swatches by keyboard', () => {
        const DRAW_FORM = SIGNATURE_FORM.replace(
            'or-appearance-signature',
            'or-appearance-draw'
        );
        const swatches = (widget) => [
            ...widget.question.querySelectorAll('[data-color]'),
        ];
        const press = (el, key) =>
            el.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key,
                    bubbles: true,
                    cancelable: true,
                })
            );

        it('each swatch is a focusable button with a name; the current one is pressed', async () => {
            const widget = await create(DRAW_FORM);
            const all = swatches(widget);
            expect(all.length).to.be.above(1);
            all.forEach((swatch, i) => {
                expect(swatch.tagName).to.equal('DIV');
                expect(swatch.getAttribute('role')).to.equal('button');
                expect(swatch.getAttribute('tabindex')).to.equal('0');
                expect(swatch.getAttribute('aria-label')).to.equal(
                    t('drawwidget.color', { color: swatch.dataset.color })
                );
                expect(swatch.getAttribute('aria-pressed')).to.equal(
                    String(i === 0)
                );
            });
        });

        it('the names follow _setCanvasName', async () => {
            const widget = await create(DRAW_FORM);
            const swatch = swatches(widget)[0];
            swatch.setAttribute('aria-label', 'stale');
            widget._setCanvasName();
            expect(swatch.getAttribute('aria-label')).to.equal(
                t('drawwidget.color', { color: swatch.dataset.color })
            );
        });

        ['Enter', ' '].forEach((key) => {
            it(`"${key}" on another swatch sets the pen colour like a click`, async () => {
                const widget = await create(DRAW_FORM);
                const [, other] = swatches(widget);
                press(other, key);
                expect(widget.pad.penColor).to.equal(other.dataset.color);
                expect(other.classList.contains('current')).to.equal(true);
                expect(other.getAttribute('aria-pressed')).to.equal('true');
                expect(
                    swatches(widget)[0].getAttribute('aria-pressed')
                ).to.equal('false');
            });

            it(`"${key}" on the current swatch toggles the row like a click`, async () => {
                const widget = await create(DRAW_FORM);
                const picker = widget.question.querySelector(
                    '.draw-widget__colorpicker'
                );
                press(swatches(widget)[0], key);
                expect(picker.classList.contains('reveal')).to.equal(true);
                press(swatches(widget)[0], key);
                expect(picker.classList.contains('reveal')).to.equal(false);
            });
        });

        it('a read-only widget has no focusable swatches and keys do nothing', async () => {
            const widget = await create(
                DRAW_FORM.replace('<input ', '<input readonly ')
            );
            const [first, other] = swatches(widget);
            const before = widget.pad.penColor;
            expect(first.getAttribute('tabindex')).to.equal('-1');
            press(other, 'Enter');
            expect(widget.pad.penColor).to.equal(before);
            expect(other.classList.contains('current')).to.equal(false);
        });
    });

    describe('in touch mode', () => {
        beforeEach(() => {
            sandbox.stub(support, 'touch').value(true);
        });

        it('the Done (hide-canvas) button has a name that update() applies again', async () => {
            const widget = await create();
            const done = widget.question.querySelector('.hide-canvas-btn');
            expect(done.getAttribute('aria-label')).to.equal(
                t('drawwidget.done')
            );
            expect(done.getAttribute('aria-label')).not.to.equal('');
            done.setAttribute('aria-label', 'stale');
            // update() runs on the form "changelanguage" event, like the UI language refresh
            widget.update();
            expect(done.getAttribute('aria-label')).to.equal(
                t('drawwidget.done')
            );
        });
    });
});
