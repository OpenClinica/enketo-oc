import pageModule from 'enketo-core/src/js/page';
import events from 'enketo-core/src/js/event';
import $ from 'jquery';
import settings from './settings';
import gui from './gui';
import announce from './announce';
import { t } from './translator';

// Announce "Page N of M" on a page change (focus is left as it is). The listener is added
// after init, so the flip to the first page at load is not announced.
const { init } = pageModule;
pageModule.init = function () {
    init.call(this);
    if (this.active) {
        this.form.view.html.addEventListener(events.PageFlip().type, () => {
            announce(
                t('form.pages.position', {
                    current: this._getCurrentIndex() + 1,
                    total: this.activePages.length,
                })
            );
        });
    }
};

// We don't use the original call, because OC only wants to (sometimes) block strict validation (not regular non-strict)
pageModule._next = function () {
    const that = this;

    this.form.validateContent($(this.current)).then((valid) => {
        const currentIndex = that._getCurrentIndex();
        const next = that._getNext(currentIndex);
        const newIndex = currentIndex + 1;

        if (next) {
            if (valid) {
                that._flipTo(next, newIndex);
            }

            // for strict-validation navigation-blocking, we ignore some errors (compared to Enketo Core module)
            if (!valid && settings.strictViolationSelector) {
                const strictViolations =
                    that.current.matches(settings.strictViolationSelector) ||
                    !!that.current.querySelector(
                        settings.strictViolationSelector
                    );

                if (
                    !strictViolations ||
                    !settings.strictViolationBlocksNavigation
                ) {
                    that._flipTo(next, newIndex);
                    // return newIndex;

                    valid = true;
                } else {
                    gui.alertStrictBlock();
                }
            }
        }

        return valid;
    });
};
