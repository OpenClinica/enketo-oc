/**
 * Keeps the page language (html[lang], WCAG 3.1.1) current. Only a language code,
 * with or without a region, is used: `default` and a form language name are not codes.
 *
 * @param {string} [lng] - language of the form or the UI
 */
export const setPageLang = (lng) => {
    if (lng && lng !== 'default' && /^[a-z]{2,3}(-|$)/i.test(lng)) {
        document.documentElement.lang = lng;
    }
};
