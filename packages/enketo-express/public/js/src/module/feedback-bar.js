export default {
    /**
     * @return {Element}
     */
    get feedbackBar() {
        if (!this._fbBar) {
            this._fbBar = document.querySelector('#feedback-bar');
        }
        return this._fbBar;
    },
    /**
     * @return {NodeList}
     */
    get messages() {
        return this.feedbackBar.querySelectorAll('p');
    },
    setCloseHandler() {
        this.feedbackBar
            .querySelector('.close')
            .addEventListener('click', () => {
                this.hide();
            });
    },
    /**
     * Shows an unobtrusive feedback bar to the user.
     *
     * Messages stay until the user closes the bar or a newer message replaces them (WCAG 2.2.1).
     *
     * @param { string } message - message to show
     */
    show(message) {
        // Max 2 messages displayed
        this.feedbackBar.classList.add('feedback-bar--show');
        const { messages } = this;
        if (messages.length > 1) {
            messages[1].remove();
        }

        // If an already shown message isn't exactly the same
        if (!messages[0] || messages[0].innerHTML !== message.trim()) {
            const newMessage = document.createElement('p');
            newMessage.innerHTML = message.trim();
            this.feedbackBar.prepend(newMessage);
        }
    },
    /**
     * Hides and empties the feedback bar
     */
    hide() {
        // The hidden bar's close button cannot keep focus (theme CSS hides it), so move
        // focus to the form title, the same target as the skip link (_skip-link.pug).
        const title = this.feedbackBar.contains(document.activeElement)
            ? document.querySelector('#form-title')
            : null;
        this.feedbackBar.classList.remove('feedback-bar--show');
        this.messages.forEach((p) => p.remove());
        if (title) {
            title.setAttribute('tabindex', '-1');
            title.focus();
        }
    },
};
