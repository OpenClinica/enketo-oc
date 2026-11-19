import Widget from '../../js/widget';
import { getSiblingElement } from '../../js/dom-utils';

// Same declarations as .oc-visually-hidden (EX _oc-a11y.scss).
const VISUALLY_HIDDEN = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    'white-space': 'nowrap',
    border: '0',
};

/**
 * Media Picker. Visually hides text labels if a media label is present.
 *
 * @augments Widget
 */
class MediaPicker extends Widget {
    /**
     * @type {string}
     */
    static get selector() {
        return '.or-appearance-no-buttons';
    }

    _init() {
        this.element
            .querySelectorAll('.option-label')
            .forEach((optionLabel) => {
                if (getSiblingElement(optionLabel, 'img, video, audio')) {
                    // Visually hidden, not display:none, so the text stays the
                    // input's accessible name. No `display` here: theme CSS hides
                    // inactive-language labels through it.
                    Object.entries(VISUALLY_HIDDEN).forEach(([prop, value]) =>
                        optionLabel.style.setProperty(prop, value, 'important')
                    );
                }
            });
    }
}

export default MediaPicker;
