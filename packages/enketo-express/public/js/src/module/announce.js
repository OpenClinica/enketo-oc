/**
 * Speaks a message to screen reader users through the live regions in
 * webform.pug (#oc-live-polite, role="status"; #oc-live-assertive, role="alert").
 * The region is emptied first, so a repeated message is a new DOM change and is spoken again.
 * Does nothing when the region is missing (e.g. headless).
 *
 * @param {string} message - text to announce
 * @param {{ assertive?: boolean }} [options] - assertive: use the alert region
 */
export default function announce(message, { assertive = false } = {}) {
    const region = document.getElementById(
        assertive ? 'oc-live-assertive' : 'oc-live-polite'
    );

    if (!region) {
        return;
    }
    region.textContent = '';
    region.append(document.createTextNode(message));
}
