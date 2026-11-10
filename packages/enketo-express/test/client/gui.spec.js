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

describe('Accessible dialogs', () => {
    /** @type {HTMLButtonElement} */
    let opener;

    beforeEach(() => {
        removeDialogs();
        opener = document.createElement('button');
        opener.textContent = 'opener';
        document.body.append(opener);
        opener.focus();
    });

    const removeDialogs = () => {
        gui.close();
        document
            .querySelectorAll('.vex, .vex-overlay')
            .forEach((el) => el.remove());
    };

    afterEach(() => {
        removeDialogs();
        opener.remove();
    });

    const keyup = (key) =>
        window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: key }));

    it('labels the confirm dialog and names the close button', () => {
        gui.confirm({ heading: 'Confirm Completion', msg: 'Sure?' });

        const content = document.querySelector('.vex-content');
        const title = document.getElementById(
            content.getAttribute('aria-labelledby')
        );

        expect(content.getAttribute('role')).to.equal('dialog');
        expect(content.getAttribute('aria-modal')).to.equal('true');
        expect(title.textContent).to.equal('Confirm Completion');
        expect(
            content.querySelector('button.vex-close').getAttribute('aria-label')
        ).to.be.a('string').that.is.not.empty;
    });

    it('returns focus to the first opener when a dialog opens from another', () => {
        gui.confirm({ msg: 'First' });
        gui.alert('Second');

        keyup(27);
        // Without the vex stylesheet no animation runs, so end it by hand.
        document
            .querySelectorAll('.vex')
            .forEach((el) => el.dispatchEvent(new Event('animationend')));

        expect(document.activeElement).to.equal(opener);
    });

    it('wraps Tab from the last control to the first and back', () => {
        gui.confirm({ msg: 'Sure?' });

        const content = document.querySelector('.vex-content');
        const items = [...content.querySelectorAll('button')];
        const first = items[0];
        const last = items[items.length - 1];
        const tab = (shiftKey) =>
            document.activeElement.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Tab',
                    shiftKey,
                    bubbles: true,
                    cancelable: true,
                })
            );

        last.focus();
        tab(false);
        expect(document.activeElement).to.equal(first);
        tab(true);
        expect(document.activeElement).to.equal(last);
    });

    it('resolves false on Escape and returns focus to the opener', async () => {
        const result = gui.confirm({ msg: 'Sure?' });

        keyup(27);

        expect(await result).to.equal(false);
        // Without the vex stylesheet no animation runs, so end it by hand.
        document.querySelector('.vex').dispatchEvent(new Event('animationend'));
        expect(document.activeElement).to.equal(opener);
    });
});
