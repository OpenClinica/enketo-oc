/**
 * Announces text to screen readers through the two visually hidden live regions that
 * surveys/webform.pug renders at page load.
 *
 * The region is cleared first and written on the next tick so that repeated messages are spoken again.
 *
 * @param {string} text - message to announce
 * @param {{assertive?: boolean}} [options] - assertive for errors, polite (default) for status messages
 */
function announce(text, { assertive = false } = {}) {
    const region = document.getElementById(
        assertive ? 'oc-live-assertive' : 'oc-live-polite'
    );

    if (!region) {
        return;
    }

    region.textContent = '';
    setTimeout(() => {
        region.textContent = text;
    }, 0);
}

export { announce };
export default announce;
