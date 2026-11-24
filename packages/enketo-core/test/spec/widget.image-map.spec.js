import ImageMapWidget from '../../src/widget/image-map/image-map';
import Radiopicker from '../../src/widget/radio/radiopicker';
import { runAllCommonWidgetTests } from '../helpers/test-widget';

const SVG =
    'data:text/svg;charset=utf-8;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5NTkiIGhlaWdodD0iNTkzIiB2aWV3Qm94PSIwIDAgOTI3IDU4NiI+DQo8dGl0bGU+QmxhbmsgVVMgc3RhdGVzIG1hcDwvdGl0bGU+DQo8Zz4NCiAgPHBhdGggZmlsbD0icGluayIgaWQ9IkNPIiBkPSJNMzgwLjIsMjM1LjUgbC0zNiwtMy41IC03OS4xLC04LjYgLTIuMiwyMi4xIC03LDUwLjQgLTEuOSwxMy43IDM0LDMuOSAzNy41LDQuNCAzNC43LDMgMTQuMywwLjZ6Ij48L3BhdGg+ICANCjwvZz4NCjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0E5QTlBOSIgc3Ryb2tlLXdpZHRoPSIyIiBkPSJNMjE1LDQ5M3Y1NWwzNiw0NSBNMCw0MjVoMTQ3bDY4LDY4aDg1bDU0LDU0djQ2Ij48L3BhdGg+DQo8L3N2Zz4=';
const FORM1 = `<form class="or">
        <fieldset class="question simple-select or-appearance-image-map">
            <fieldset>
                <legend>
                    <span lang="default" class="question-label active" >Select states from the image</span>
                    <img lang="default" class="active" src="${SVG}" alt="">
                </legend>
                <div class="option-wrapper">
                    <label>
                        <input type="radio" name="/w/im" data-name="123" value="CO" data-type-xml="select1">
                        <span lang="" class="option-label active">Colorado/span>
                    </label>
                </div>
            </fieldset>
        </fieldset>
    </form>`;
// const FORM2 = FORM1.replace( '"radio"', '"checkbox"' );

// Note that these tests may not be testing what they appear to be testing.
// Because of the unusual implementation of the widget, the tests don't actually check what is displayed on the map (e.g. a loaded value)
runAllCommonWidgetTests(ImageMapWidget, FORM1, 'CO');

// the test with checkboxes don't run because input.setVal and input.getVal are not compatible for select_multiple type questions.
// One uses space-separated value and the other uses and array.
// runAllCommonWidgetTests( ImageMapWidget, FORM2, [ 'CO' ] );

describe('image-map keyboard access', () => {
    const create = async (template = FORM1) => {
        const fragment = document
            .createRange()
            .createContextualFragment(template);
        const control = fragment.querySelector(ImageMapWidget.selector);
        const host = document.createElement('div');
        host.append(fragment);
        document.body.append(host);
        const widget = await new ImageMapWidget(control);

        return { host, control, widget };
    };

    let host;
    afterEach(() => host && host.remove());

    it('does not hide the option inputs with display: none', async () => {
        ({ host } = await create());
        const css = await (
            await fetch('/base/src/widget/image-map/image-map.scss')
        ).text();
        const rule = css.match(
            /\.option-wrapper:not\(:focus-within\)\s*\{[^}]*\}/
        )[0];
        expect(rule).to.not.contain('display: none');
        expect(rule).to.contain('clip: rect(0, 0, 0, 0)');
    });

    it('hides the inlined svg from assistive technology', async () => {
        ({ host } = await create());
        expect(
            host.querySelector('.image-map > svg').getAttribute('aria-hidden')
        ).to.equal('true');
    });

    it('gives the same value and map highlight for a keyboard choice as for an svg click', async () => {
        let ctx = await create();
        let path = ctx.host.querySelector('svg path#CO');
        expect(path.hasAttribute('or-selected')).to.equal(false);
        path.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const clicked = ctx.widget.value;
        expect(clicked).to.equal('CO');
        expect(path.hasAttribute('or-selected')).to.equal(true);
        ctx.host.remove();

        ctx = await create();
        host = ctx.host;
        path = ctx.host.querySelector('svg path#CO');
        expect(path.hasAttribute('or-selected')).to.equal(false);
        ctx.control.checked = true;
        ctx.control.dispatchEvent(new Event('change', { bubbles: true }));
        expect(ctx.widget.value).to.equal(clicked);
        expect(path.hasAttribute('or-selected')).to.equal(true);
    });

    it('ignores svg clicks and marks the map read-only for a read-only widget', async () => {
        ({ host } = await create(
            FORM1.replace('type="radio"', 'type="radio" readonly disabled')
        ));
        const svg = host.querySelector('.image-map > svg');
        const path = svg.querySelector('path#CO');
        expect(svg.hasAttribute('or-readonly')).to.equal(true);
        path.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(host.querySelector('input').checked).to.equal(false);
        expect(path.hasAttribute('or-selected')).to.equal(false);
    });

    describe('Delete and Backspace clear a checked option', () => {
        const press = (el, key) =>
            el.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key,
                    bubbles: true,
                    cancelable: true,
                })
            );

        ['Delete', 'Backspace'].forEach((key) => {
            it(`${key} on a focused checked option unchecks it, fires change and clears the highlight`, async () => {
                const ctx = await create(FORM1.replace('radio', 'checkbox'));
                host = ctx.host;
                const path = host.querySelector('svg path#CO');
                path.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                expect(ctx.control.checked).to.equal(true);
                let changes = 0;
                ctx.control.addEventListener('change', () => changes++);
                ctx.control.focus();
                const event = press(ctx.control, key);
                expect(ctx.control.checked).to.equal(false);
                expect(changes).to.equal(1);
                expect(path.hasAttribute('or-selected')).to.equal(false);
                expect(event).to.equal(false);
            });
        });

        it('a radio option is cleared too', async () => {
            const ctx = await create();
            host = ctx.host;
            ctx.control.checked = true;
            ctx.control.focus();
            press(ctx.control, 'Delete');
            expect(ctx.control.checked).to.equal(false);
        });

        it('lets a native click (Space) select the option again, with the radio unselect handler active', async () => {
            const ctx = await create();
            host = ctx.host;
            // eslint-disable-next-line no-new
            new Radiopicker(host.querySelector('form'));
            // a native Space on a focused radio fires a click
            ctx.control.click();
            expect(ctx.control.checked).to.equal(true);
            ctx.control.focus();
            press(ctx.control, 'Delete');
            expect(ctx.control.checked).to.equal(false);
            ctx.control.click();
            expect(ctx.control.checked).to.equal(true);
        });

        it('keeps the option state in step after an svg click unselects, so click (Space) selects again', async () => {
            const ctx = await create();
            host = ctx.host;
            // eslint-disable-next-line no-new
            new Radiopicker(host.querySelector('form'));
            ctx.control.click();
            expect(ctx.control.checked).to.equal(true);
            host.querySelector('svg path#CO').dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
            expect(ctx.control.checked).to.equal(false);
            ctx.control.click();
            expect(ctx.control.checked).to.equal(true);
        });

        it('clears the stale state of a previous radio option when another is chosen on the map', async () => {
            const svg = `data:image/svg+xml;utf8,${encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><path id="CO" d="M0,0h9v9h-9z"/><path id="UT" d="M10,0h9v9h-9z"/></svg>'
            )}`;
            const form = FORM1.replace(SVG, svg).replace(
                '</div>',
                `<label>
                        <input type="radio" name="/w/im" data-name="123" value="UT" data-type-xml="select1">
                        <span lang="" class="option-label active">Utah</span>
                    </label></div>`
            );
            const ctx = await create(form);
            host = ctx.host;
            // eslint-disable-next-line no-new
            new Radiopicker(host.querySelector('form'));
            const ut = host.querySelector('input[value="UT"]');
            ctx.control.click();
            host.querySelector('svg path#UT').dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
            expect(ut.checked).to.equal(true);
            ctx.control.click();
            expect(ctx.control.checked).to.equal(true);
        });

        it('does nothing for an unchecked option', async () => {
            const ctx = await create();
            host = ctx.host;
            let changes = 0;
            ctx.control.addEventListener('change', () => changes++);
            ctx.control.focus();
            expect(press(ctx.control, 'Delete')).to.equal(true);
            expect(changes).to.equal(0);
        });

        it('does nothing when the option is not focused', async () => {
            const ctx = await create();
            host = ctx.host;
            ctx.control.checked = true;
            ctx.control.blur();
            press(ctx.control, 'Delete');
            expect(ctx.control.checked).to.equal(true);
        });

        it('does nothing in a read-only widget', async () => {
            const ctx = await create(
                FORM1.replace('type="radio"', 'type="radio" readonly')
            );
            host = ctx.host;
            ctx.control.checked = true;
            ctx.control.focus();
            press(ctx.control, 'Delete');
            expect(ctx.control.checked).to.equal(true);
        });
    });
});
