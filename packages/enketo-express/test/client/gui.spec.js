import i18next from 'i18next';
import vex from 'vex-js';
import gui from '../../public/js/src/module/gui';

describe('Alert dialogs', () => {
    /** @type {HTMLElement | null} */
    let dialog;

    beforeEach(() => {
        dialog = null;
    });

    afterEach(() => {
        if (dialog != null) {
            const overlay = document.querySelector('.vex-overlay');

            dialog.remove();
            overlay.remove();
        }
    });

    const entities = {
        '&agrave;': 'à',
        '&eacute;': 'é',
        '&igrave;': 'ì',
        '&ograve;': 'ò',
        '&ugrave;': 'ù',
        '&Agrave;': 'À',
        '&Eacute;': 'É',
        '&Egrave;': 'È',
        '&Igrave;': 'Ì',
        '&Ograve;': 'Ò',
        '&Ugrave;': 'Ù',
    };

    Object.entries(entities).forEach(([entity, expected]) => {
        it('does not escape HTML entities in translations', () => {
            gui.alert(entity);

            dialog = document.querySelector('.vex');

            expect(dialog.innerText).to.include(expected);
            expect(dialog.innerText).not.to.include(entity);
        });
    });
});

describe('vex dialog accessibility', () => {
    /** @type {HTMLElement[]} */
    let added;

    const add = (html) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        const el = wrapper.firstElementChild;
        document.body.append(el);
        added.push(el);

        return el;
    };

    const openDialogs = () =>
        [...document.querySelectorAll('.vex')].filter(
            (el) => !el.classList.contains('vex-closing')
        );

    const content = () => openDialogs().pop().querySelector('.vex-content');

    const keydownTab = (target, shiftKey = false) => {
        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey,
            bubbles: true,
            cancelable: true,
        });
        target.dispatchEvent(event);

        return event;
    };

    // vex removes a closed dialog on animationend (0.5 s with the theme CSS).
    // Karma loads no CSS, so no animationend fires: a test fires it by hand.
    const finishClose = (vexEl) =>
        vexEl.dispatchEvent(new Event('animationend'));

    const finishAllClosing = () =>
        document.querySelectorAll('.vex.vex-closing').forEach(finishClose);

    beforeEach(() => {
        added = [];
    });

    afterEach(() => {
        added.forEach((el) => el.remove());
        vex.closeAll();
        finishAllClosing();
    });

    it('a confirm dialog is a named dialog', () => {
        gui.confirm('msg');
        const el = content();
        const title = el.querySelector('.vex-dialog-title');

        expect(el.getAttribute('role')).to.equal('dialog');
        expect(el.getAttribute('aria-modal')).to.equal('true');
        expect(title.id).not.to.equal('');
        expect(el.getAttribute('aria-labelledby')).to.equal(title.id);
    });

    it('the close control is a named button in the Tab order', () => {
        gui.confirm('msg');
        const el = content();
        const close = el.querySelector('.vex-close');

        expect(el.querySelector('div.vex-close')).to.equal(null);
        expect(close.tagName).to.equal('BUTTON');
        expect(close.type).to.equal('button');
        expect(close.getAttribute('aria-label')).to.be.a('string').and.not
            .empty;
        expect(close.tabIndex).to.equal(0);
    });

    it('the close button closes the dialog', () => {
        const result = gui.confirm('msg');
        content().querySelector('.vex-close').click();

        expect(openDialogs().length).to.equal(0);

        return result.then((value) => expect(value).to.equal(false));
    });

    it('Tab from the last control goes to the first, Shift+Tab from the first to the last', () => {
        gui.confirm('msg');
        const el = content();
        const first = el.querySelector('.vex-dialog-button.vex-first');
        const last = el.querySelector('.vex-close');

        last.focus();
        let event = keydownTab(last);
        expect(document.activeElement).to.equal(first);
        expect(event.defaultPrevented).to.equal(true);

        event = keydownTab(first, true);
        expect(document.activeElement).to.equal(last);
        expect(event.defaultPrevented).to.equal(true);

        const middle = el.querySelector('.vex-dialog-button.vex-last');
        middle.focus();
        event = keydownTab(middle);
        expect(event.defaultPrevented).to.equal(false);
    });

    it('closing returns focus to the element focused before open', () => {
        const opener = add('<button type="button">open</button>');
        opener.focus();
        gui.alert('msg');
        expect(document.activeElement).not.to.equal(opener);

        content().querySelector('.vex-dialog-button').click();
        finishAllClosing();

        expect(document.querySelector('.vex')).to.equal(null);
        expect(document.activeElement).to.equal(opener);
    });

    // The Complete button is disabled (btnBusyState) while Confirm Completion is open.
    it('closing returns focus to an opener that was disabled at open, once it is enabled again', async () => {
        const opener = add('<button type="button">open</button>');
        opener.focus();
        opener.disabled = true;
        // Chromium moves focus off a disabled element (at once or at the next
        // rendering step, by version); blur to model it.
        opener.blur();
        expect(document.activeElement).to.equal(document.body);
        gui.confirm('msg');

        content().querySelector('.vex-close').click();
        finishAllClosing();
        expect(document.activeElement).to.equal(document.body);

        opener.disabled = false;
        // MutationObserver callbacks run as a microtask.
        await Promise.resolve();

        expect(document.activeElement).to.equal(opener);
    });

    it('Tab and Shift+Tab wrap when focus is on the dialog itself', () => {
        gui.confirm('msg');
        const el = content();
        const first = el.querySelector('.vex-dialog-button.vex-first');
        const last = el.querySelector('.vex-close');

        el.tabIndex = -1;
        el.focus();
        let event = keydownTab(el);
        expect(document.activeElement).to.equal(first);
        expect(event.defaultPrevented).to.equal(true);

        el.focus();
        event = keydownTab(el, true);
        expect(document.activeElement).to.equal(last);
        expect(event.defaultPrevented).to.equal(true);
    });

    it('focus is not pulled back when another vex dialog is open at close time', () => {
        const opener = add('<button type="button">open</button>');
        opener.focus();
        gui.alert('first');
        const firstVex = document.querySelector('.vex');
        gui.confirm('second');
        const second = content();

        finishClose(firstVex);

        expect(second.contains(document.activeElement)).to.equal(true);
    });

    it('focus is not pulled back when focus already moved to a form field', () => {
        const opener = add('<button type="button">open</button>');
        const field = add('<input type="text">');
        opener.focus();
        gui.alert('msg');
        field.focus();

        vex.closeAll();
        finishAllClosing();

        expect(document.activeElement).to.equal(field);
    });

    it('an opener inside a vex dialog is ignored', () => {
        const box = add(
            '<div class="vex"><button type="button">in</button></div>'
        );
        const inner = box.querySelector('button');
        inner.focus();
        gui.alert('msg');

        content().querySelector('.vex-dialog-button').click();
        finishAllClosing();

        expect(document.activeElement).not.to.equal(inner);
    });

    const buttonTexts = (el) =>
        [...el.querySelectorAll('.vex-dialog-button')].map(
            (b) => b.textContent
        );

    it('negValue is what the negative button resolves; Escape and the close button still resolve false', async () => {
        let result = gui.confirm('msg', { negValue: 'leave' });
        content().querySelector('.btn-default').click();
        expect(await result).to.equal('leave');
        finishAllClosing();

        result = gui.confirm('msg', { negValue: 'leave' });
        content().querySelector('.vex-close').click();
        expect(await result).to.equal(false);
        finishAllClosing();

        result = gui.confirm('msg');
        content().querySelector('.btn-default').click();
        expect(await result).to.equal(false);
    });

    it('an alert given a duration does not close itself', () => {
        const spy = sinon.spy(vex.dialog, 'alert');
        try {
            gui.alert('msg', 'heading', 'info', 2);
            expect(spy.firstCall.args[0].autoClose).to.equal(undefined);
        } finally {
            spy.restore();
        }
    });

    it('negFirst renders Cancel before Confirm and focuses Cancel', () => {
        gui.confirm('msg', {
            posButton: 'Yes',
            negButton: 'No',
            negFirst: true,
        });
        const el = content();
        const cancel = el.querySelector('.vex-dialog-button.vex-first');

        expect(buttonTexts(el)).to.deep.equal(['No', 'Yes']);
        expect(
            openDialogs().pop().classList.contains('vex-neg-first')
        ).to.equal(true);
        expect(document.activeElement).to.equal(cancel);
    });

    it('without negFirst the button order is unchanged', () => {
        gui.confirm('msg', { posButton: 'Yes', negButton: 'No' });
        const el = content();

        expect(buttonTexts(el)).to.deep.equal(['Yes', 'No']);
        expect(
            openDialogs().pop().classList.contains('vex-neg-first')
        ).to.equal(false);
        expect(document.activeElement).to.equal(
            el.querySelector('.vex-dialog-button.vex-first')
        );
    });

    // A synthetic keydown does not activate a button, so the test checks nothing
    // intercepts Enter and Cancel is not a submit button, then does what the browser does
    // for Enter on a focused button: click it.
    it('Enter on the focused Cancel resolves false', () => {
        const result = gui.confirm('msg', { negButton: 'No', negFirst: true });
        const cancel = document.activeElement;
        const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
        });
        cancel.dispatchEvent(event);

        expect(cancel.textContent).to.equal('No');
        expect(cancel.type).to.equal('button');
        expect(event.defaultPrevented).to.equal(false);
        cancel.click();

        expect(openDialogs().length).to.equal(0);

        return result.then((value) => expect(value).to.equal(false));
    });

    it('Escape closes the dialog and resolves false', () => {
        const result = gui.confirm('msg');
        const event = new KeyboardEvent('keyup', {
            key: 'Escape',
            bubbles: true,
        });
        Object.defineProperty(event, 'keyCode', { get: () => 27 });
        document.activeElement.dispatchEvent(event);

        expect(openDialogs().length).to.equal(0);

        return result.then((value) => expect(value).to.equal(false));
    });
    describe('keys with focus on the page body', () => {
        const press = (key, extra = {}) => {
            const event = new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
                ...extra,
            });
            document.body.dispatchEvent(event);

            return event;
        };
        const blur = () => document.activeElement.blur();

        it('Escape closes the dialog and Tab moves focus into it', () => {
            gui.confirm('msg');
            blur();
            const event = press('Tab');
            expect(event.defaultPrevented).to.equal(true);
            expect(content().contains(document.activeElement)).to.equal(true);

            blur();
            const up = new KeyboardEvent('keyup', {
                key: 'Escape',
                bubbles: true,
            });
            Object.defineProperty(up, 'keyCode', { get: () => 27 });
            document.body.dispatchEvent(up);
            expect(openDialogs().length).to.equal(0);
        });

        it('Escape keydown from body, held or not, closes no dialog of a stack', () => {
            gui.confirm('lower');
            const top = vex.dialog.alert('top');
            blur();
            press('Escape');
            expect(openDialogs().length).to.equal(2);
            // Close the top one by hand: a held key must not reach the lower one.
            top.close();
            press('Escape', { repeat: true });
            press('Escape');
            expect(openDialogs().length).to.equal(1);
        });

        it('Tab from body while the dialog closes does not move focus into it', () => {
            gui.confirm('msg');
            const el = content();
            el.querySelector('.vex-close').click();
            blur();
            const event = press('Tab');
            expect(event.defaultPrevented).to.equal(false);
            expect(el.contains(document.activeElement)).to.equal(false);
        });

        it('after the dialog closes, Escape and Tab on body do nothing', () => {
            gui.confirm('msg');
            content().querySelector('.vex-close').click();
            finishAllClosing();
            blur();

            expect(press('Tab').defaultPrevented).to.equal(false);
            gui.confirm('other', { allowAlternativeClose: false });
            blur();
            press('Escape');
            expect(openDialogs().length).to.equal(1);
        });

        it('opening twice registers one listener per open dialog', () => {
            const add = sinon.spy(document, 'addEventListener');
            const remove = sinon.spy(document, 'removeEventListener');
            gui.confirm('one');
            gui.confirm('two');
            finishAllClosing();
            blur();
            const keydowns = (spy) =>
                spy.args.filter(([type]) => type === 'keydown').length;
            const added = keydowns(add);
            const removed = keydowns(remove);
            add.restore();
            remove.restore();

            expect(added).to.equal(2);
            // The first dialog closed when the second opened.
            expect(removed).to.equal(1);
            expect(openDialogs().length).to.equal(1);
        });

        it('focus inside the dialog is left to the dialog (Escape keydown does nothing)', () => {
            gui.confirm('msg');
            content().querySelector('.vex-dialog-button').focus();
            press('Escape');
            expect(openDialogs().length).to.equal(1);
        });
    });
});

describe('Server-rendered accessible names', () => {
    it('follow the UI language through data-i18n-aria-label', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-label', 'stale');
        button.dataset.i18nAriaLabel = 'alert.close';
        document.body.append(button);

        // i18next emits this after the UI language has switched.
        i18next.emit('languageChanged', 'de');

        expect(button.getAttribute('aria-label')).to.equal(
            i18next.t('alert.close')
        );
        expect(button.getAttribute('aria-label')).to.not.equal('stale');
        button.remove();
    });
});

describe('Save draft info dialog', () => {
    it('hides the cloned toggle icon from assistive technology', () => {
        const toggle = document.createElement('button');
        toggle.className = 'side-slider__toggle';
        toggle.setAttribute('aria-label', 'open');
        document.body.append(toggle);
        const stub = sinon
            .stub(i18next, 't')
            .callsFake((key, options) => (options && options.icon) || key);
        gui.showSaveDraftInfo();
        stub.restore();
        const icon = document.querySelector('.vex .side-slider__toggle');

        expect(icon).to.not.equal(null);
        expect(icon.getAttribute('aria-hidden')).to.equal('true');
        vex.closeAll();
        document
            .querySelectorAll('.vex, .vex-overlay')
            .forEach((el) => el.remove());
        toggle.remove();
    });
});
