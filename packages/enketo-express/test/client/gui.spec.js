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
});
