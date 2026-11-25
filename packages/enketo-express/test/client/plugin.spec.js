import $ from 'jquery';
import '../../public/js/src/module/plugin';

describe('JQuery plugins', () => {
    describe('btnText', () => {
        it('can change the text of a button', () => {
            const $button = $('<button><i> </i>submit</button>');
            $button.btnText('save');
            expect($button[0].lastChild.textContent).to.equal('save');
        });

        it('can change the text of a button if busy state is busy during change', () => {
            const $button = $('<button><i> </i>submit</button>');
            $button.btnBusyState(true);
            $button.btnText('save');
            $button.btnBusyState(false);
            expect($button[0].lastChild.textContent).to.equal('save');
        });
    });

    describe('btnBusyState', () => {
        it('names the busy button with its text and marks it busy, then restores it', () => {
            const $button = $(
                '<button><i class="icon"> </i><span>Submit</span></button>'
            );
            $button.btnBusyState(true);
            expect($button[0].getAttribute('aria-label')).to.equal('Submit');
            expect($button[0].getAttribute('aria-busy')).to.equal('true');
            $button.btnBusyState(false);
            expect($button[0].hasAttribute('aria-label')).to.equal(false);
            expect($button[0].hasAttribute('aria-busy')).to.equal(false);
            expect($button[0].textContent.trim()).to.equal('Submit');
        });
    });
});
