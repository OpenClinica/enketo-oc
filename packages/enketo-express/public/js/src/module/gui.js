/**
 * Deals with the main GUI elements (but not the survey form)
 */

import support from 'enketo-core/src/js/support';

import * as printHelper from 'enketo-core/src/js/print';
import vex from 'vex-js';
import $ from 'jquery';
import vexEnketoDialog from 'vex-dialog-enketo';
import feedbackBar from './feedback-bar';
import announce from './announce';
import settings from './settings';
import { init as initTranslator, t, onUiLanguageChange } from './translator';
import sniffer from './sniffer';
import events from './event';
import './plugin';

let pages;
let homeScreenGuidance;
let updateStatus;
let formTheme;

/**
 * @typedef HeadlessResult
 * @property { string= } error
 * @property { number= } fieldSubmissions
 */

// Customize vex
vex.registerPlugin(vexEnketoDialog);
vex.defaultOptions.className = 'vex-theme-plain';

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]';

// Accessible names rendered by the server (aria-label=t(key)) follow the UI language.
// The element carries its key in data-i18n-aria-label; localize() only rewrites text.
onUiLanguageChange(() => {
    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
        el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    });
});

/**
 * Keeps Tab and Shift+Tab inside a container: focus wraps from the last
 * visible, enabled control to the first, and back.
 *
 * @param {HTMLElement} container - a dialog or dialog-like widget
 */
function trapTab(container) {
    container.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') {
            return;
        }
        const items = _getTabStops(container);
        const index = items.indexOf(document.activeElement);
        const last = items.length - 1;

        // index -1: focus is on the container text or the container itself.
        if (event.shiftKey && index <= 0) {
            event.preventDefault();
            items[last].focus();
        } else if (!event.shiftKey && (index === -1 || index === last)) {
            event.preventDefault();
            items[0].focus();
        }
    });
}

/**
 * @param {HTMLElement} container - a dialog or dialog-like widget
 * @return {HTMLElement[]} the visible, enabled controls in Tab order
 */
function _getTabStops(container) {
    return [...container.querySelectorAll(FOCUSABLE)].filter(
        (el) =>
            !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0
    );
}

/**
 * While a dialog is open and focus is on the page body (for example after a
 * click on the backdrop), Escape runs onEscape and Tab moves focus into the dialog.
 * Focus inside any element is left to that element's own handlers.
 *
 * @param {HTMLElement} container - the dialog
 * @param {Function} [onEscape] - what Escape does, the same as in the dialog; omit if another handler already closes it
 * @param {Function} [isOpen] - Tab and Escape do nothing while this returns false (a closing dialog)
 * @return {Function} removes the listener; call it when the dialog closes
 */
function keysFromBody(container, onEscape, isOpen = () => true) {
    const onBody = () => {
        const active = document.activeElement;

        return !active || active === document.body;
    };
    const onKeydown = (event) => {
        if (event.key !== 'Tab' || !onBody() || event.repeat || !isOpen()) {
            return;
        }
        const items = _getTabStops(container);
        if (items.length) {
            event.preventDefault();
            items[event.shiftKey ? items.length - 1 : 0].focus();
        }
    };
    // Escape acts on keyup: vex closes its top dialog on a window keyup, so a dialog that
    // onEscape opens on keydown would be closed by the same key. Stop it before it gets there.
    const onKeyup = (event) => {
        if (event.key === 'Escape' && onBody() && isOpen()) {
            event.stopPropagation();
            onEscape();
        }
    };
    document.addEventListener('keydown', onKeydown);
    if (onEscape) {
        document.addEventListener('keyup', onKeyup);
    }

    return () => {
        document.removeEventListener('keydown', onKeydown);
        document.removeEventListener('keyup', onKeyup);
    };
}

// A button that is disabled when it is clicked (btnBusyState) loses focus to body,
// so the last focused element is kept to find the opener.
let lastFocused = null;
document.addEventListener('focusin', (event) => {
    lastFocused = event.target;
});

// The opener of each vex dialog, by its content element (set in _makeDialogAccessible).
const dialogOpeners = new WeakMap();

/**
 * Returns the element to give focus back to when a dialog closes.
 * An element inside a vex dialog is not used, because that dialog closes:
 * a dialog opened from a dialog (Confirm, then a progress alert) takes the
 * opener of that dialog instead.
 *
 * @return {HTMLElement|null} opener
 */
function _getOpener() {
    let el = document.activeElement;

    if ((!el || el === document.body) && lastFocused && lastFocused.disabled) {
        el = lastFocused;
    }
    if (!el || el === document.body) {
        return null;
    }
    const dialog = el.closest('.vex');

    return dialog
        ? dialogOpeners.get(dialog.querySelector('.vex-content')) || null
        : el;
}

/**
 * Makes a vex dialog a named modal dialog, makes its close control a button,
 * keeps Tab inside it, and gives focus back to the opener when it closes.
 *
 * @param {object} vexInstance - the instance that vex.dialog.* returns
 * @param {HTMLElement|null} opener - the element focused before the dialog opened
 */
function _makeDialogAccessible(vexInstance, opener) {
    const { contentEl, closeEl, options } = vexInstance;
    const title = contentEl.querySelector('.vex-dialog-title');

    dialogOpeners.set(contentEl, opener);

    contentEl.setAttribute('role', 'dialog');
    contentEl.setAttribute('aria-modal', 'true');
    if (title) {
        title.id = `vex-dialog-title-${vexInstance.id}`;
        contentEl.setAttribute('aria-labelledby', title.id);
    }

    if (closeEl) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = closeEl.className;
        button.setAttribute('aria-label', t('alert.close'));
        button.addEventListener('click', () => vexInstance.close());
        closeEl.replaceWith(button);
        vexInstance.closeEl = button;
    }

    trapTab(contentEl);

    // Escape from body is already closed by the vex window keyup listener; only Tab is added here.
    const removeBodyKeys = keysFromBody(
        contentEl,
        null,
        () => vexInstance.isOpen
    );

    // vex calls afterClose after its close animation, so another dialog may be open by then,
    // or the user may have moved focus to a form field.
    const { afterClose } = options;
    options.afterClose = function dialogAfterClose() {
        removeBodyKeys();
        if (afterClose) {
            afterClose.call(this);
        }
        if (!opener) {
            return;
        }
        const returnFocus = () => {
            const active = document.activeElement;
            const otherOpen = Object.values(vex.getAll()).some((v) => v.isOpen);

            if (
                opener.isConnected &&
                !otherOpen &&
                (!active || active === document.body)
            ) {
                opener.focus();
            }
        };

        if (!opener.disabled) {
            returnFocus();

            return;
        }
        // A disabled element cannot take focus: wait until it is enabled again.
        // ponytail: the observer stays if the opener is never enabled again (e.g. the page unloads).
        const observer = new MutationObserver(() => {
            if (!opener.disabled) {
                observer.disconnect();
                returnFocus();
            }
        });
        observer.observe(opener, {
            attributes: true,
            attributeFilter: ['disabled'],
        });
    };
}

/**
 * Initializes the GUI module
 */
function init() {
    initTranslator().then(setEventHandlers);

    // TODO: remove
    // avoid Windows console errors
    if (typeof window.console === 'undefined') {
        window.console = {
            log() {
                // Intentional noop
            },
        };
    }
    if (typeof window.console.debug === 'undefined') {
        console.debug = console.log;
    }

    // override feature detection (for development purposes)
    if (settings.touch) {
        support.touch = true;
        $('html').addClass('touch');
    } else if (settings.touch === false) {
        support.touch = false;
        $('html').removeClass('touch');
    }
}

/**
 * Shows the dialog that explains the save-draft icon.
 */
function showSaveDraftInfo() {
    const icon = document.querySelector('.side-slider__toggle').cloneNode(true);
    icon.setAttribute('aria-hidden', 'true');
    icon.style.position = 'static';
    icon.style.margin = '10px auto';
    icon.style.display = 'block';
    icon.disabled = true;
    const msg = t('alert.savedraftinfo.msg', {
        icon: icon.outerHTML,
        // switch off escaping just for this known safe value
        interpolation: {
            escapeValue: false,
        },
    });
    alert(msg, t('alert.savedraftinfo.heading'), 'normal');
}

/**
 * Sets the default (common) UI eventhandlers (extended in each class for custom handlers)
 */
function setEventHandlers() {
    const $doc = $(document);

    feedbackBar.setCloseHandler();

    $doc.on('click', '.side-slider .close, .slider-overlay', () => {
        $('body').removeClass('show-side-slider');
    });

    $('.form-header__button--print').on('click', printOcForm);

    $('.side-slider__toggle, .offline-enabled__queue-length').on(
        'click',
        () => {
            const $body = $('body');
            window.scrollTo(0, 0);
            $body.toggleClass('show-side-slider');
        }
    );

    $('.offline-enabled__icon').on('click', () => {
        const msg = t('alert.offlinesupported.msg');
        alert(msg, t('alert.offlinesupported.heading'), 'normal');
    });

    // use delegated handler because btnBusyState removes button content
    $('#save-draft').on('click', '.save-draft-info', showSaveDraftInfo);

    $('a.branding').on('click', function () {
        const href = this.getAttribute('href');

        return !(!href || href === '#');
    });

    if (_getHomeScreenGuidance()) {
        $('.form-header__button--homescreen')
            .removeClass('hide')
            .on('click', alertHomeScreenGuidance);
    }

    $doc.on('xpatherror', (ev, error) => {
        const email = settings.supportEmail;
        const link = `<a href="mailto:${email}?subject=xpath errors for: ${encodeURIComponent(
            location.href
        )}&body=${encodeURIComponent(error)}" target="_blank" >${email}</a>`;

        alert(
            `${t('alert.xpatherror.msg', {
                emailLink: link,
                // switch off escaping just for this known safe value
                interpolation: {
                    escapeValue: false,
                },
            })}<ul class="error-list"><li>${error}</li></ul>`,
            t('alert.xpatherror.heading')
        );
    });

    $('.side-slider__app-version').on('click', () => {
        $('.side-slider__advanced').toggleClass('hide');
    });
}

function swapTheme(formParts) {
    const requestedTheme = formParts.theme;
    const $styleSheets = $('link[rel=stylesheet][href*=theme-]');
    const matches = /\/theme-([A-z]+)(\.print)?\.css/.exec(
        $styleSheets.eq(0).attr('href')
    );

    formTheme = matches !== null ? matches[1] : null;

    return new Promise((resolve) => {
        if (
            requestedTheme &&
            requestedTheme !== formTheme &&
            settings.themesSupported.some(
                (supportedTheme) => requestedTheme === supportedTheme
            )
        ) {
            const $replacementSheets = [];
            $styleSheets.each(function () {
                $replacementSheets.push(
                    $(
                        this.outerHTML.replace(
                            /(href=.*\/theme-)[A-z]+((\.print)?\.css)/,
                            `$1${requestedTheme}$2`
                        )
                    )
                );
            });
            console.log('Swapping theme to', requestedTheme);
            $replacementSheets[0].on('load', () => {
                formTheme = requestedTheme;
                resolve(formParts);
            });

            $styleSheets.each(function (index) {
                $(this).replaceWith($replacementSheets[index]);
            });
        } else {
            console.log('Keeping default theme.');
            delete formParts.theme;
            resolve(formParts);
        }
    });
}

/**
 * Select what type of unobtrusive feedback message to show to the user.
 *
 * @param { string }  message - message to show
 * @param {string=} heading - heading to show (on mobile only)
 */
function feedback(message, heading = t('feedback.header')) {
    if (!support.touch) {
        feedbackBar.show(message);
    } else {
        alert(message, heading, 'info');
    }
}

/**
 * Shows a modal alert dialog.
 * TODO: parameters should change to (content, options)
 *
 * @param { string } message - message to show
 * @param {string=} heading - heading to show
 * @param {string=} level - css class or normal (no styling) ('alert', 'info', 'warning', 'error', 'success', 'oc-strict-error')
 */
function alert(message, heading, level) {
    level = level || 'error';
    const opener = _getOpener();
    vex.closeAll();
    const instance = vex.dialog.alert({
        unsafeMessage: `<span>${message}</span>`,
        title: heading || t('alert.default.heading'),
        messageClassName: level === 'normal' ? '' : `alert-box ${level}`,
        buttons: [
            {
                text: t('alert.validationsuccess.heading'),
                type: 'submit',
                className: 'btn btn-primary small',
            },
        ],
        showCloseButton: true,
    });
    _makeDialogAccessible(instance, opener);

    return Promise.resolve();
}

/**
 * Closes any currently-shown modal dialog (e.g. a transient "bare" alert
 * like the field-submission-queue spinner) without showing a new one.
 */
function close() {
    vex.closeAll();
}

/**
 * Shows a confirmation dialog
 *
 * @param {?(object.<string, (string|boolean)>|string)=} content - In its simplest form this is just a string but it can
 *                                                         also an object with parameters msg, heading and errorMsg.
 * @param {object=} choices - button texts (posButton, negButton), allowAlternativeClose; `negFirst: true` puts Cancel first (and focused); `negValue` is what the negative button resolves (default false); it must be truthy, because vex resolves `this.value || false`
 */
function confirm(content, choices) {
    let errorMsg = '';
    const message = typeof content === 'string' ? content : content.msg;

    if (content.errorMsg) {
        errorMsg = `<p class="alert-box error">${content.errorMsg}</p>`;
    }

    return new Promise((resolve) => {
        choices = choices || {};
        choices.allowAlternativeClose =
            typeof choices.allowAlternativeClose !== 'undefined'
                ? choices.allowAlternativeClose
                : true;

        const yes = $.extend({}, vex.dialog.buttons.YES, {
            text: choices.posButton || t('confirm.default.posButton'),
            className: 'btn btn-primary small',
        });
        const no = $.extend({}, vex.dialog.buttons.NO, {
            text: choices.negButton || t('confirm.default.negButton'),
            className: 'btn btn-default small',
        });
        if (choices.negValue !== undefined) {
            // Escape, the close button and the overlay still resolve false.
            no.click = function negClick() {
                this.value = choices.negValue;
                this.close();
            };
        }
        const opener = _getOpener();
        vex.closeAll();
        // vex focuses the first button, so negFirst also puts initial focus on Cancel.
        const instance = vex.dialog.confirm({
            unsafeMessage: errorMsg + (message || t('confirm.default.msg')),
            title: content.heading || t('confirm.default.heading'),
            buttons: choices.negFirst ? [no, yes] : [yes, no],
            callback: resolve,
            afterClose: resolve,
            showCloseButton: choices.allowAlternativeClose,
            escapeButtonCloses: choices.allowAlternativeClose,
            overlayClosesOnClick: choices.allowAlternativeClose,
        });
        if (choices.negFirst) {
            instance.rootEl.classList.add('vex-neg-first');
        }
        _makeDialogAccessible(instance, opener);
    });
}

function prompt(content, choices, inputs) {
    let errorMsg = '';
    const message = typeof content === 'string' ? content : content.msg;

    if (content.errorMsg) {
        errorMsg = `<p class="alert-box error">${content.errorMsg}</p>`;
    }

    return new Promise((resolve) => {
        choices = choices || {};

        const opener = _getOpener();
        vex.closeAll();
        const instance = vex.dialog.prompt({
            unsafeMessage: errorMsg + (message || ''),
            title: content.heading || t('prompt.default.heading'),
            buttons: [
                $.extend({}, vex.dialog.buttons.YES, {
                    text: choices.posButton || t('confirm.default.posButton'),
                    className: 'btn btn-primary small',
                }),
                $.extend({}, vex.dialog.buttons.NO, {
                    text: choices.negButton || t('confirm.default.negButton'),
                    className: 'btn btn-default small',
                }),
            ],
            input: inputs,
            callback: resolve,
            showCloseButton: true,
        });
        _makeDialogAccessible(instance, opener);
    });
}

/**
 * Shows modal asking for confirmation to redirect to login screen
 *
 * @param  {string=} msg -       message to show
 */
function confirmLogin(msg) {
    msg = msg || t('confirm.login.msg');

    confirm(
        {
            msg,
            heading: t('confirm.login.heading'),
        },
        {
            posButton: t('confirm.login.posButton'),
            negButton: t('confirm.login.negButton'),
        }
    ).then((confirmed) => {
        if (!confirmed) {
            return;
        }
        let search = `?return_url=${encodeURIComponent(location.href)}`;
        search += settings.touch ? `&touch=${settings.touch}` : '';
        search += settings.debug ? `&debug=${settings.debug}` : '';
        location.href = `${location.protocol}//${location.host}${settings.loginUrl}${search}`;
    });
}

/**
 * @typedef AlertLoadErrorsOptions
 * @property {boolean} [omitIntro]
 * @property {boolean} [omitSupportContact]
 */

/**
 * Shows modal with load errors
 *
 * @param {string[]} loadErrors -  load error messagesg
 * @param {string} [advice] -  a string with advice
 * @param {AlertLoadErrorsOptions} [options]
 */
/*
function alertLoadErrors(loadErrors, advice, options = {}) {
    const errors = loadErrors.map(
        (error) => `<p>${error.split('\n\n').join('</p><p>')}</p>`
    );
    const errorStringHTML =
        loadErrors.length === 1
            ? `${errors[0]}`
            : `<ul class="error-list"><li>${errors.join(
                  '</li><li>'
              )}</li></ul>`;
    const errorStringEmail = `* ${loadErrors.join('\n* ')}`;
    const email = settings.supportEmail;
    const link = `<a href="mailto:${email}?subject=loading errors for: ${encodeURIComponent(
        location.href
    )}&body=${encodeURIComponent(
        errorStringEmail
    )}" target="_blank" >${email}</a>`;
    const params = {
        emailLink: link,
        count: loadErrors.length,
        // switch off escaping just for this known safe value
        interpolation: {
            escapeValue: false,
        },
    };

    advice = advice || '';

    const introMessage = options.omitIntro
        ? ''
        : `${t('alert.loaderror.msg1', params)} `;
    const supportContactMessage = options.omitSupportContact
        ? ''
        : `<p>${t('alert.loaderror.msg2', params)}</p>`;

    alert(
        `<p>${introMessage}${advice}</p>${supportContactMessage}${errorStringHTML}`,
        t('alert.loaderror.heading', params)
    );
}
*/

function alertLoadErrorsOc(loadErrors) {
    const errorStringHTML = loadErrors
        .map((error) => `<p>${error}</p>`)
        .join('');
    alert(errorStringHTML, t('alert.loaderror.heading'));
}

function alertStrictError(msg) {
    msg += `<p><strong>${t(
        'fieldsubmission.alert.stricterror.msg'
    )}</strong></p>`;
    alert(
        msg,
        t('fieldsubmission.alert.stricterror.heading'),
        'oc-strict-error'
    );
}

function alertStrictBlock() {
    const icon =
        '<i class="icon icon-exclamation-circle oc-strict-error" aria-hidden="true"> </i>';
    alert(
        t('fieldsubmission.alert.participanterror.msg'),
        icon + t('alert.loaderror.heading'),
        'oc-strict-error'
    );
}

function alertHomeScreenGuidance() {
    alert(
        _getHomeScreenGuidance(),
        t('alert.addtohomescreen.heading'),
        'normal'
    );
}

function confirmAutoQueries() {
    return confirm(
        {
            heading: t('alert.default.heading'),
            errorMsg: t('fieldsubmission.confirm.autoquery.msg1'),
            msg: t('fieldsubmission.confirm.autoquery.msg2'),
        },
        {
            posButton: t('fieldsubmission.confirm.autoquery.automatic'),
            negButton: t('fieldsubmission.confirm.autoquery.manual'),
        }
    );
}

function _getHomeScreenGuidance() {
    let imageClass1;
    const { browser } = sniffer;
    const { os } = sniffer;

    if (homeScreenGuidance) {
        // keep calm
    } else if (os.ios && browser.safari) {
        imageClass1 = 'ios-safari';
        homeScreenGuidance = t(
            'alert.addtohomescreen.iossafari.msg',
            _getHomeScreenGuidanceObj(imageClass1)
        );
    } else if (os.android && browser.chrome) {
        imageClass1 = 'android-chrome';
        homeScreenGuidance = t(
            'alert.addtohomescreen.androidchrome.msg',
            _getHomeScreenGuidanceObj(imageClass1)
        );
    } else if (os.android && browser.firefox) {
        homeScreenGuidance = t(
            'alert.addtohomescreen.androidfirefox.msg',
            _getHomeScreenGuidanceObj()
        );
    }

    return homeScreenGuidance;
}

function _getHomeScreenGuidanceObj(imageClass1, imageClass2) {
    return {
        image1: imageClass1 ? `<span class="${imageClass1}"/>` : '',
        image2: imageClass2 ? `<span class="${imageClass2}"/>` : '',
        // switch off escaping just for these known safe values
        interpolation: {
            escapeValue: false,
        },
    };
}

/**
 * Prompts for print settings (for Grid Theme) and prints from the regular view of the form.
 */
/*
function printForm() {
    const components = getPrintDialogComponents();
    const texts = {
        heading: components.heading,
        msg: components.msg,
    };
    const options = {
        posButton: components.posButton,
        negButton: components.negButton,
    };
    const inputs = components.gridInputs + components.gridWarning;
    const questions = document.querySelectorAll('.question');

    printHelper.openAllDetails();
    questions.forEach((question) => question.dispatchEvent(events.Printify()));

    if (formTheme === 'grid' || (!formTheme && printHelper.isGrid())) {
        return prompt(texts, options, inputs)
            .then((values) => {
                if (values) {
                    return printGrid(values);
                }
            })
            .then(() => {
                printHelper.closeAllDetails();
                questions.forEach((question) =>
                    question.dispatchEvent(events.DePrintify())
                );
            });
    }
    window.print();
    printHelper.closeAllDetails();
    questions.forEach((question) =>
        question.dispatchEvent(events.DePrintify())
    );

    return Promise.resolve();
}
*/

function printOcForm() {
    const components = getPrintDialogComponents();
    const texts = {
        heading: components.heading,
        msg: components.msg,
    };
    const options = {
        posButton: components.posButton,
        negButton: components.negButton,
    };
    const inputDn = `<fieldset>
            <legend>${t('confirm.print.queries')}</legend>
            <label>
                <input name="queries" style="margin-left: 10px;" type="checkbox" value="yes" checked/>
                <span>${t('confirm.print.queryShow')}</span>
            </label>
        </fieldset>`;
    const gridInputs = inputDn + components.gridInputs + components.gridWarning;
    const regularInputs = inputDn;

    const dns = document.querySelectorAll('.or-appearance-dn');
    const textPrints = document.querySelectorAll(
        '.question:not(.or-appearance-autocomplete):not(.or-appearance-url) > input[type=text]:not(.ignore):not([data-for]), .question:not(.or-appearance-autocomplete):not(.or-appearance-url) > textarea:not(.ignore):not([data-for])'
    );
    let historyAdded = false;

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            textPrints.forEach((textPrint) => {
                textPrint.dispatchEvent(events.DePrintify());
            });
            if (historyAdded) {
                return new Promise((resolveCleanup) => {
                    setTimeout(() => {
                        dns.forEach((dn) => {
                            dn.dispatchEvent(events.DePrintify());
                        });
                        resolveCleanup();
                    }, 1000);
                });
            }
            return Promise.resolve();
        };

        const handlePrint = (format) => {
            if (!format) {
                return cleanup().then(resolve);
            }

            if (format.queries === 'yes') {
                historyAdded = true;
                dns.forEach((dn) => {
                    dn.dispatchEvent(events.Printify());
                });
            }

            textPrints.forEach((textPrint) => {
                textPrint.dispatchEvent(events.Printify());
            });

            textPrints.forEach((textPrint) => {
                textPrint.dispatchEvent(events.ClickPrintify());
            });

            if (formTheme === 'grid' || (!formTheme && printHelper.isGrid())) {
                return printGrid(format)
                    .then(() => cleanup())
                    .then(resolve)
                    .catch((error) => {
                        cleanup().then(() => reject(error));
                    });
            }

            return new Promise((resolvePrint) => {
                setTimeout(() => {
                    window.print();
                    resolvePrint();
                }, 100);
            })
                .then(() => cleanup())
                .then(resolve)
                .catch((error) => {
                    cleanup().then(() => reject(error));
                });
        };

        const promptInputs =
            formTheme === 'grid' || (!formTheme && printHelper.isGrid())
                ? gridInputs
                : regularInputs;

        prompt(texts, options, promptInputs)
            .then(handlePrint)
            .catch((error) => {
                cleanup().then(() => reject(error));
            });
    });
}

/**
 * Separated this to allow using parts in custom print dialogs.
 *
 */
function getPrintDialogComponents() {
    // used function because i18next needs to be initalized for t() to work
    return {
        heading: t('confirm.print.heading'),
        msg: t('confirm.print.msg'),
        posButton: t('confirm.print.posButton'),
        negButton: t('alert.default.button'),
        gridInputs: `<fieldset><legend>${t(
            'confirm.print.psize'
        )}</legend><label><input name="format" type="radio" value="A4" required checked/><span>${t(
            'confirm.print.a4'
        )}</span></label><label><input name="format" type="radio" value="Letter" required/><span>${t(
            'confirm.print.letter'
        )}</span></label></fieldset><fieldset><legend>${t(
            'confirm.print.orientation'
        )}</legend><label><input name="orientation" type="radio" value="portrait" required checked/><span>${t(
            'confirm.print.portrait'
        )}</span></label><label><input name="orientation" type="radio" value="landscape" required/><span>${t(
            'confirm.print.landscape'
        )}</span></label></fieldset>`,
        gridWarning: `<p class="alert-box info" >${t(
            'confirm.print.reminder'
        )}</p>`,
    };
}

function printGrid(format, delay = 800) {
    const swapped = printHelper.styleToAll();

    // https://github.com/OpenClinica/enketo-express-oc/issues/456
    // changing style on chrome takes longer than other browser
    return new Promise((resolve) =>
        setTimeout(() => {
            printHelper
                .fixGrid(format)
                .then(() => window.print())
                .catch(console.error)
                .then(() => {
                    if (swapped) {
                        return new Promise((innerResolve) => {
                            setTimeout(() => {
                                printHelper.styleReset();
                                innerResolve();
                            }, 500);
                        });
                    }
                })
                .finally(() => resolve());
        }, delay)
    );
}

/**
 * This is function is used by PDF creation functionality from a special print view of the form..
 */
function applyPrintStyle() {
    imagesLoaded()
        .then(() => {
            printHelper.openAllDetails();
            document
                .querySelectorAll('.question')
                .forEach((question) =>
                    question.dispatchEvent(events.Printify())
                );

            if (formTheme === 'grid' || (!formTheme && printHelper.isGrid())) {
                const paper = {
                    format: settings.format,
                    landscape: settings.landscape,
                    scale: settings.scale,
                    margin: settings.margin,
                };

                return printHelper.fixGrid(paper);
            }
        })
        .then(() => {
            window.printReady = true;
        })
        .catch(console.error);
}

function imagesLoaded() {
    return new Promise((resolve) => {
        let images = [...document.images];
        const interval = setInterval(() => {
            images = images.filter((image) => !image.complete);
            if (images.length === 0) {
                clearInterval(interval);
                resolve();
            }
        }, 150);
    });
}

function alertCacheUnsupported() {
    const message = t('alert.offlineunsupported.msg');
    const choices = {
        posButton: t('alert.offlineunsupported.posButton'),
        negButton: t('alert.offlineunsupported.negButton'),
    };
    confirm(
        {
            msg: message,
            heading: t('alert.offlineunsupported.heading'),
        },
        choices
    ).then((confirmed) => {
        if (confirmed) {
            window.location = settings.modernBrowsersURL;
        }
    });
}

// Last offline state, so the hidden status text can follow a UI language change.
let lastOfflineCapable;

// The icon is `title`-only; the title follows the state and the UI language.
function setOfflineIconTitle() {
    const icon = document.querySelector('.offline-enabled__icon');
    if (icon) {
        icon.title = t(
            lastOfflineCapable
                ? 'offline.status.enabled'
                : 'offline.status.disabled'
        );
    }
}
let offlineLanguageListener = false;

/**
 * Updates various statuses in the GUI (connection, form-edited, browsersupport)
 *
 * @type { object }
 */
updateStatus = {
    offlineCapable(offlineCapable) {
        if (offlineCapable) {
            $('.offline-enabled__icon.not-enabled').removeClass('not-enabled');
        } else {
            $('.offline-enabled__icon').addClass('not-enabled');
        }

        lastOfflineCapable = offlineCapable;
        setOfflineIconTitle();
        if (!offlineLanguageListener) {
            offlineLanguageListener = true;
            // Rewrite the text in the new language. No announcement: the state did not change.
            onUiLanguageChange(() => {
                setOfflineIconTitle();
                const el = document.querySelector('.offline-enabled__status');
                if (el && el.textContent !== '') {
                    el.textContent = t(
                        lastOfflineCapable
                            ? 'offline.status.enabled'
                            : 'offline.status.disabled'
                    );
                }
            });
        }

        // Text for the `title`-only icon; announced when it changes (not when first set).
        const status = document.querySelector('.offline-enabled__status');
        const text = t(
            offlineCapable
                ? 'offline.status.enabled'
                : 'offline.status.disabled'
        );
        if (status && status.textContent !== text) {
            const changed = status.textContent !== '';
            status.textContent = text;
            if (changed) {
                announce(text);
            }
        }
    },
    applicationVersion(version) {
        $('.side-slider__app-version__value').text(version);
    },
};

function getErrorResponseMsg(statusCode) {
    let msg;
    const supportEmailObj = {
        supportEmail: settings.supportEmail,
    };
    const contactSupport = t('contact.support', supportEmailObj);
    const contactAdmin = t('contact.admin');
    const statusMap = {
        0: t('submission.http0'),
        200: `${t('submission.http2xx')}<br/>${contactSupport}`,
        '2xx': `${t('submission.http2xx')}<br/>${contactSupport}`,
        400: `${t('submission.http400')}<br/>${contactAdmin}`,
        401: t('submission.http401'),
        403: `${t('submission.http403')}<br/>${contactAdmin}`,
        404: t('submission.http404'),
        408: t('submission.http408'),
        '4xx': t('submission.http4xx'),
        413: `${t('submission.http413')}<br/>${contactSupport}`,
        500: t('submission.http500', supportEmailObj),
        503: t('submission.http500', supportEmailObj),
        504: t('submission.http504', supportEmailObj),
        '5xx': t('submission.http500', supportEmailObj),
    };

    statusCode =
        typeof statusCode !== 'undefined' ? statusCode.toString() : 'undefined';

    if (statusMap[statusCode]) {
        msg = `${statusMap[statusCode]} (${statusCode})`;
    } else if (statusMap[statusCode.replace(statusCode.substring(1), 'xx')]) {
        msg = `${
            statusMap[statusCode.replace(statusCode.substring(1), 'xx')]
        } (${statusCode})`;
    } else {
        msg = `${t('error.unknown')} (${statusCode})`;
    }

    return msg;
}

/**
 * Shows a form loading result that a headless API responder can parse.
 *
 * @param {HeadlessResult} result
 */
function showHeadlessResult(result) {
    const resultFragment = document
        .createRange()
        .createContextualFragment(
            `<div
                id="headless-result"
                style="position: fixed; width: 100%; background: pink; top: 0; left: 0;
                    border: 5px solid black; padding: 10px 20px; text-align:center;"
            ></div>`
        )
        .querySelector('#headless-result');

    if (result.error) {
        resultFragment.append(
            document
                .createRange()
                .createContextualFragment(
                    `<div id="error">${result.error}</div>`
                )
        );
    } else {
        resultFragment.append(
            document.createRange().createContextualFragment(
                `<div
            id="fieldsubmissions"
            style="border: 5px dotted black; display: inline-block; padding: 10px 20px;"
        >${result.fieldsubmissions}</div>`
            )
        );
    }

    document.querySelector('body').append(resultFragment);
}

$(document).ready(() => {
    init();
});

export default {
    showSaveDraftInfo,
    alert,
    trapTab,
    keysFromBody,
    close,
    confirm,
    prompt,
    feedback,
    updateStatus,
    pages,
    swapTheme,
    confirmLogin,
    alertLoadErrors: alertLoadErrorsOc,
    alertCacheUnsupported,
    confirmAutoQueries,
    getErrorResponseMsg,
    applyPrintStyle,
    getPrintDialogComponents,
    alertStrictError,
    alertStrictBlock,
    showHeadlessResult,
};
