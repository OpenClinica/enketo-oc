/**
 * Accessibility (OC-29440): keeps aria-invalid and aria-describedby on a form control in step with the visible
 * validation state of its question and of any enclosing group marked invalid-relevant.
 * Shared by Form.syncAriaInvalid and widgets that set their own validity (number-input).
 */

let ariaMsgCounter = 0;

/**
 * @param {Element} msg - message element that needs an id to be referenced
 * @return {string} its id
 */
function ensureMsgId(msg) {
    if (!msg.id) {
        ariaMsgCounter += 1;
        msg.id = `or-msg-${ariaMsgCounter}`;
    }

    return msg.id;
}

/**
 * @param {Element} input - a form control
 */
export function syncInputAria(input) {
    const known = [];
    const msgIds = [];
    let invalid = false;
    const question = input.closest('.question, .calculation');

    if (question) {
        const classes = [...question.classList];
        const selectors = [];
        if (classes.includes('invalid-required')) {
            selectors.push('.or-required-msg.active');
        }
        if (classes.some((cl) => cl.indexOf('invalid-constraint') === 0)) {
            selectors.push('.or-constraint-msg.active');
        }
        if (classes.includes('invalid-relevant')) {
            selectors.push('.or-relevant-msg.active');
        }
        // number-input widget: native number-format error, set by the widget itself
        if (classes.includes('invalid-value')) {
            selectors.push('.invalid-value-msg.active');
        }
        question
            .querySelectorAll(
                '.or-required-msg, .or-constraint-msg, .or-relevant-msg, .invalid-value-msg'
            )
            .forEach((msg) => {
                if (msg.id) {
                    known.push(msg.id);
                }
                if (selectors.length && msg.matches(selectors.join(', '))) {
                    msgIds.push(ensureMsgId(msg));
                }
            });
        invalid = selectors.length > 0;
    }

    // enclosing groups marked invalid-relevant: only their own (direct child) message belongs to them
    let group = (question || input).parentElement
        ? (question || input).parentElement.closest('.or-group, .or-group-data')
        : null;
    while (group) {
        const groupInvalid = group.classList.contains('invalid-relevant');
        [...group.children]
            .filter((el) => el.matches('.or-relevant-msg'))
            .forEach((msg) => {
                if (msg.id) {
                    known.push(msg.id);
                }
                if (groupInvalid && msg.matches('.active')) {
                    msgIds.push(ensureMsgId(msg));
                }
            });
        invalid = invalid || groupInvalid;
        group = group.parentElement
            ? group.parentElement.closest('.or-group, .or-group-data')
            : null;
    }

    const targets = [input];
    // desktop selects hide the <select> and take focus on the .bootstrap-select toggle button instead
    if (input.matches('select') && question) {
        const toggle = question.querySelector(
            '.bootstrap-select .dropdown-toggle'
        );
        if (toggle) {
            targets.push(toggle);
        }
    }
    targets.forEach((el) => applyAria(el, invalid, known, msgIds));
}

/**
 * @param {Element} el - element that receives the state
 * @param {boolean} invalid - whether it is invalid
 * @param {Array<string>} known - all message ids this helper manages for it
 * @param {Array<string>} msgIds - ids of the messages that currently describe it
 */
function applyAria(el, invalid, known, msgIds) {
    if (invalid) {
        el.setAttribute('aria-invalid', 'true');
    } else {
        el.removeAttribute('aria-invalid');
    }
    // keep any other aria-describedby values (e.g. hint), replace only message ids
    const others = (el.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && !known.includes(id) && !msgIds.includes(id));
    const ids = [...others, ...msgIds];
    if (ids.length) {
        el.setAttribute('aria-describedby', ids.join(' '));
    } else {
        el.removeAttribute('aria-describedby');
    }
}
