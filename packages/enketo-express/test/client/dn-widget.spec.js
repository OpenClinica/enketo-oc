import Dn from '../../widget/discrepancy-note/dn-widget';
import vex from 'vex-js';
import { t } from '../../public/js/src/module/translator';
import i18next from 'i18next';

Dn.prototype._init = () => {};
const fragment = document.createRange().createContextualFragment(
    `<form>
        <label class="question">
            <input name="/data/node"/>
        </label>
        <label class="question or-appearance-dn">
            <input name="/data/comment" data-for="/data/node">
        </label>
    </form>`
);
const el = fragment.querySelector('[data-for]');

describe('DN object', () => {
    describe('parses JSON string', () => {
        const dn = new Dn(el);

        [
            'a',
            '[]',
            '{queries:[], logs:[]}',
            true,
            null,
            false,
            {},
            [],
            {
                a: true,
            },
            {
                queries: [],
                logs: [],
            },
        ].forEach((test) => {
            it('throws an error, if the JSON string is invalid or not a string', () => {
                const parse = () => {
                    dn._parseModelFromString(test);
                };
                expect(parse).to.throw(/Failed to parse discrepancy/);
            });
        });

        ['', '{}'].forEach((test) => {
            it('returns an empty model if the JSON string is an empty string or an empty stringified object', () => {
                expect(dn._parseModelFromString(test)).to.deep.equal({
                    queries: [],
                    logs: [],
                });
            });
        });

        [
            '{"queries":[], "logs":[]}',
            '{"queries":[],"logs": [{ "type": "comment", "status": "updated", "message": "This is an older comment.", "user" : "Maurice Moss (moss)", "date_time" : "2016-04-22 14:44:20 -06:00"},{ "type": "audit",  "message": "Item data value updated from old_value to new_value.",  "user" : "Jen Barber (jen)","date_time" : "2016-05-18 12:44:20 -06:00" }]}',
        ].forEach((test) => {
            it('returns the correct model if the JSON string is a valid stringified object', () => {
                expect(dn._parseModelFromString(test)).to.deep.equal(
                    JSON.parse(test)
                );
            });
        });
    });

    describe('extracts the current status from the discrepancy note data model', () => {
        const dn = new Dn(el);

        [
            ['{}', ''],
            ['{"logs":[], "queries":[{"type": "comment"}]}', ''],
            [
                '{"logs":[], "queries":[{"type": "comment", "status": "updated"}]}',
                'updated',
            ],
            [
                '{"logs":[], "queries":[{"type": "audit"},{"type": "comment", "status": "updated"}]}',
                'updated',
            ],
            // [ '{"logs":[], "queries":[{"type": "comment", "status":"new"},{"type": "comment", "status": "updated"}]}', 'new' ],
            [
                '{"queries":[{"type": "comment", "status": "closed"}], "logs":[{"type": "comment", "status": "updated"}]}',
                'closed',
            ],
            // [ '{"logs":[], "queries":[{"type": "comment", "status": "new"},{"type": "comment", "status": "closed"} ]}', 'new' ],
            [
                '{"logs":[], "queries":[{"type": "comment", "status": "new", "date_time": "2016-09-01 15:01 -06:00" },{"type": "comment", "status": "closed", "date_time": "2016-09-01 15:02 -06:00"}]}',
                'closed',
            ],
            [
                '{"logs":[], "queries":[{"type": "comment", "status": "new", "date_time": "2016-09-01 15:02 -06:00" },{"type": "comment", "status": "closed", "date_time": "2016-09-01 15:01 -06:00"}]}',
                'new',
            ],
            [
                '{"logs":[], "queries":[' +
                    '{"type": "comment", "thread_id":"a", "status": "updated", "date_time": "2016-09-01 15:02 -06:00" },' +
                    '{"type": "comment", "thread_id":"a", "status": "closed", "date_time": "2016-09-01 15:01 -06:00"},' +
                    '{"type": "comment", "thread_id":"b", "status": "new", "date_time": "2016-07-01 15:01 -06:00"}' +
                    ']}',
                'new',
            ],
            [
                '{"logs":[], "queries":[' +
                    '{"type": "comment", "thread_id":"a", "status": "updated", "date_time": "2016-09-01 15:02 -06:00" },' +
                    '{"type": "comment", "thread_id":"a", "status": "closed", "date_time": "2016-09-01 15:01 -06:00"},' +
                    '{"type": "comment", "thread_id":"b", "status": "closed-modified", "date_time": "2016-07-01 15:01 -06:00"}' +
                    ']}',
                'updated',
            ],
            [
                '{"logs":[], "queries":[' +
                    '{"type": "comment", "thread_id":"a", "status": "closed", "date_time": "2016-09-01 15:02 -06:00" },' +
                    '{"type": "comment", "thread_id":"a", "status": "updated", "date_time": "2016-09-01 15:01 -06:00"},' +
                    '{"type": "comment", "thread_id":"b", "status": "closed-modified", "date_time": "2016-07-01 15:01 -06:00"}' +
                    ']}',
                'closed',
            ],
        ].forEach((test) => {
            it('and returns the correct status', () => {
                const model = dn._parseModelFromString(test[0]);
                expect(model).to.be.an('object');
                expect(dn._getCurrentStatus(model)).to.equal(test[1]);
            });
        });
    });

    describe('getting parsed elapsed time from datetime string', () => {
        const dn = new Dn(el);

        [false, true, null, 'a', {}, []].forEach((test) => {
            it('returns "error" when an invalid datetime string is provided', () => {
                expect(dn._getParsedElapsedTimeUpTo7Days(test)).to.equal(
                    'error'
                );
            });
        });
    });

    describe('parsing elapsed time from milliseconds', () => {
        const dn = new Dn(el);

        [-1, -Infinity, false, true, null, 'a', {}, []].forEach((test) => {
            it('returns "error" when not a number or a negative number is provided', () => {
                expect(dn._getParsedElapsedTimeUpTo7Days(test)).to.equal(
                    'error'
                );
            });
        });

        [
            [0, 'widget.dn.now'],
            [29999, 'widget.dn.now'],
            [30000, 'widget.dn.minute', 1],
            [59.5 * 60 * 1000 - 1, 'widget.dn.minute', 59],
            [59.5 * 60 * 1000, 'widget.dn.hour', 1],
            [1.5 * 60 * 60 * 1000, 'widget.dn.hour', 2],
            [23.5 * 60 * 60 * 1000 - 1, 'widget.dn.hour', 23],
            [23.5 * 60 * 60 * 1000, 'widget.dn.day', 1],
            [7 * 24 * 60 * 60 * 1000, 'widget.dn.day', 7],
            [7.01 * 24 * 60 * 60 * 1000, null],
            [(5 / 12 + 30 - 0.5) * 24 * 60 * 60 * 1000 - 1, null],
            // [ ( 5 / 12 + 30 - 0.5 ) * 24 * 60 * 60 * 1000, 'widget.dn.month', 1 ],
            // [ 11.5 * ( 5 / 12 + 30 ) * 24 * 60 * 60 * 1000 - 1, 'widget.dn.month', 11 ],
            // [ 11.5 * ( 5 / 12 + 30 ) * 24 * 60 * 60 * 1000, 'widget.dn.year', 1 ],
            // [ 1.5 * 12 * ( 5 / 12 + 30 ) * 24 * 60 * 60 * 1000, 'widget.dn.year', 2 ],
        ].forEach((test) => {
            // TODO: figure out a way to test the test[2] part of the expected return,
            // perhaps by spying on the t() function (which I failed to do), or loading the proper translator.
            it('returns correct human-readable response', () => {
                expect(dn._parseElapsedTimeUpTo7Days(test[0])).to.equal(
                    test[1]
                );
            });
        });
    });

    describe('sorting queries and logs', () => {
        const dn = new Dn(el);
        const a = {
            date_time: '2016-09-01 15:01 -06:00',
        };
        const b = {
            date_time: '2016-09-01 14:01:00.001 -06:00',
        };
        const c = {
            date_time: '2016-09-01 14:01 -06:00',
        };
        const d = {};

        [
            [a, b, c, d],
            [a, b, d, c],
            [a, c, d, b],
            [a, c, b, d],
            [a, d, b, c],
            [a, d, c, b],
            [b, a, c, d],
            [b, a, d, c],
            [b, c, a, d],
            [b, c, d, a],
            [b, d, a, c],
            [b, d, c, a],
            [c, a, b, d],
            [c, a, d, b],
            [c, b, a, d],
            [c, b, d, a],
            [c, d, a, b],
            [c, d, b, a],
            [d, a, b, c],
            [d, a, c, b],
            [d, b, a, c],
            [d, b, c, a],
            [d, c, a, b],
            [d, c, b, a],
        ].forEach((test) => {
            it(`sorts by datetime in descending order: ${JSON.stringify(
                test
            )}`, () => {
                expect(test.sort(dn._datetimeDesc.bind(dn))).to.deep.equal([
                    a,
                    b,
                    c,
                    d,
                ]);
            });
        });
    });

    describe('filtering queries by type and thread id and optionally include logs', () => {
        const dn = new Dn(el);

        it('filters by type', () => {
            const n = {
                queries: [
                    { comment: 'a', type: 'comment' },
                    { comment: 'b', type: 'reason' },
                    { comment: 'c', type: 'comment' },
                ],
                logs: [{ comment: 'some log' }],
            };
            expect(dn._filteredNotes(n, 'comment')).to.deep.equal([
                { comment: 'a', type: 'comment' },
                { comment: 'c', type: 'comment' },
                { comment: 'some log' },
            ]);
            expect(dn._filteredNotes(n, 'reason')).to.deep.equal([
                { comment: 'b', type: 'reason' },
                { comment: 'some log' },
            ]);
            expect(dn._filteredNotes(n, 'nothing')).to.deep.equal([
                { comment: 'some log' },
            ]);
            expect(
                dn._filteredNotes(n, 'comment', undefined, false)
            ).to.deep.equal([
                { comment: 'a', type: 'comment' },
                { comment: 'c', type: 'comment' },
            ]);
            expect(
                dn._filteredNotes(n, 'reason', undefined, false)
            ).to.deep.equal([{ comment: 'b', type: 'reason' }]);
            expect(
                dn._filteredNotes(n, 'nothing', undefined, false)
            ).to.deep.equal([]);
        });

        it('filters by thread', () => {
            const n = {
                queries: [
                    { comment: 'a', type: 'comment', thread_id: 'abc' },
                    { comment: 'b', type: 'reason' },
                    { comment: 'c', type: 'comment', thread_id: 'bef' },
                    { comment: 'd', type: 'comment', thread_id: 'abc' },
                ],
                logs: [],
            };
            expect(dn._filteredNotes(n, 'comment', 'abc')).to.deep.equal([
                { comment: 'a', type: 'comment', thread_id: 'abc' },
                { comment: 'd', type: 'comment', thread_id: 'abc' },
            ]);
        });

        // old dn data structure without thread_id (NULL)
        it('filters by absence of thread_id if keyword "NULL" is provided', () => {
            const n = {
                queries: [
                    { comment: 'a', type: 'comment' },
                    { comment: 'b', type: 'reason' },
                    { comment: 'c', type: 'comment', thread_id: 'bef' },
                    { comment: 'd', type: 'comment' },
                ],
                logs: [],
            };
            expect(dn._filteredNotes(n, 'comment', 'NULL')).to.deep.equal([
                { comment: 'a', type: 'comment' },
                { comment: 'd', type: 'comment' },
            ]);
            expect(dn._filteredNotes(n, null, 'NULL')).to.deep.equal([
                { comment: 'a', type: 'comment' },
                { comment: 'b', type: 'reason' },
                { comment: 'd', type: 'comment' },
            ]);
        });

        it('disregards thread_id if undefined or "*" is provided as argument', () => {
            const n = {
                queries: [
                    { comment: 'a', type: 'comment' },
                    { comment: 'b', type: 'reason' },
                    { comment: 'c', type: 'comment', thread_id: 'bef' },
                    { comment: 'd', type: 'comment' },
                ],
                logs: [],
            };
            expect(dn._filteredNotes(n, 'comment', undefined)).to.deep.equal([
                { comment: 'a', type: 'comment' },
                { comment: 'c', type: 'comment', thread_id: 'bef' },
                { comment: 'd', type: 'comment' },
            ]);
            expect(dn._filteredNotes(n, 'comment', '*')).to.deep.equal([
                { comment: 'a', type: 'comment' },
                { comment: 'c', type: 'comment', thread_id: 'bef' },
                { comment: 'd', type: 'comment' },
            ]);
        });

        it('filters by thread_id === "" if "" is provided as argument', () => {
            const n = {
                queries: [
                    { comment: 'a', type: 'comment' },
                    { comment: 'b', type: 'reason' },
                    { comment: 'c', type: 'comment', thread_id: 'bef' },
                    { comment: 'd', type: 'comment' },
                ],
                logs: [],
            };
            expect(dn._filteredNotes(n, 'comment', '')).to.deep.equal([]);
        });
    });

    describe('extracting default assignee', () => {
        const dn = new Dn(el);
        [
            ['{}', ''],
            ['{"queries":[], "logs":[{"type": "comment"}]}', ''],
            // first has system user
            [
                '{"queries":[], "logs":[{"type": "comment", "status": "updated", "user": "system", "date_time":2}]}',
                '',
            ],
            [
                '{"queries":[{"type": "comment", "status": "updated", "user": "system", "date_time":2}], "logs":[]}',
                '',
            ],
            // first has empty user
            [
                '{"queries":[], "logs":[{"type": "audit", "user": "", "date_time":2000},{"type": "comment", "user": "jen", "date_time":1000}]}',
                '',
            ],
            [
                '{"queries":[{"type": "audit", "user": "", "date_time":2},{"type": "comment", "user": "jen",  "date_time":1}], "logs":[]}',
                '',
            ],
            // first has no user
            [
                '{"queries":[], "logs":[{"type": "audit", "date_time":2},{"type": "comment", "user": "jen", "date_time":1}]}',
                '',
            ],
            [
                '{"queries":[{"type": "audit", "date_time":2},{"type": "comment", "user": "jen", "date_time":1}], "logs":[]}',
                '',
            ],
            // first root ignored, next is taken
            [
                '{"queries":[], "logs":[{"type": "audit", "user": "system", "date_time":2},{"type": "comment", "user": "jen", "date_time":1}]}',
                'jen',
            ],
            [
                '{"queries":[{"type": "audit", "user": "system", "date_time":2},{"type": "comment", "user": "jen", "date_time":1}], "logs":[]}',
                'jen',
            ],
            // same, but switched order (same date_time) to test ordering
            [
                '{"queries":[], "logs":[{"type": "comment", "user": "jen", "date_time":1}, {"type": "audit", "user": "system", "date_time":2}]}',
                'jen',
            ],
            [
                '{"queries":[{"type": "comment", "user": "jen", "date_time":1}, {"type": "audit", "user": "system", "date_time":2}], "logs":[]}',
                'jen',
            ],
        ].forEach((test) => {
            it('works', () => {
                const notes = dn._parseModelFromString(test[0]);
                expect(dn._getDefaultAssignee(notes)).to.equal(test[1]);
            });
        });
    });
});

describe('query dialog accessibility', () => {
    let form;
    let dn;

    const OPEN_THREAD =
        '{"queries":[{"type":"comment","id":"1","date_time":"2019-05-03 11:08:06.802 -06:00","comment":"x","status":"new","assigned_to":"","notify":false,"thread_id":"abc","user":"jen"}],"logs":[]}';

    const key = (target, type, name, extra = {}) => {
        const event = new KeyboardEvent(type, {
            key: name,
            bubbles: true,
            cancelable: true,
            ...extra,
        });
        if (name === 'Escape') {
            Object.defineProperty(event, 'keyCode', { get: () => 27 });
        }
        target.dispatchEvent(event);

        return event;
    };
    const escape = (target) => {
        key(target, 'keydown', 'Escape');
        key(target, 'keyup', 'Escape');
    };
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    const widget = () => form.querySelector('.or-comment-widget');
    const textarea = () => widget().querySelector('[name="dn-comment"]');
    const closeButton = () =>
        widget().querySelector('.or-comment-widget__content__btn-close-x');
    const openDialogs = () =>
        [...document.querySelectorAll('.vex')].filter(
            (el) => !el.classList.contains('vex-closing')
        );
    // Karma loads no CSS, so vex never gets animationend: fire it by hand.
    const finishAllClosing = () =>
        document
            .querySelectorAll('.vex.vex-closing')
            .forEach((el) => el.dispatchEvent(new Event('animationend')));
    const openWithTextarea = () => {
        dn._showCommentModal();
        widget().querySelector('button[data-type="comment"]').click();
    };

    beforeEach(() => {
        form = document
            .createRange()
            .createContextualFragment(
                `<form class="or">
                    <label class="question">
                        <span class="question-label">Q</span>
                        <a class="btn-icon-only btn-comment btn-dn" tabindex="-1" type="button" href="#"></a>
                        <input name="/data/node"/>
                    </label>
                    <label class="question or-appearance-dn">
                        <span class="question-label">C</span>
                        <textarea name="/data/comment" data-for="/data/node"></textarea>
                    </label>
                </form>`
            )
            .querySelector('form');
        document.body.append(form);
        dn = new Dn(form.querySelector('[data-for]'));
        dn.linkedQuestion = form.querySelector('.question');
        dn.commentButton = form.querySelector('.btn-dn');
        dn.notes = { queries: [], logs: [] };
        dn.readOnly = false;
        dn.usersOptionsHtml = '<option value=""></option>';
        dn.linkedQuestionErrorMsg = '';
        // `users` is module state that _init sets; these tests skip _init.
        dn._parseFullName = () => 'Jen';
        dn._parseInitials = () => 'J';
    });

    afterEach(() => {
        form.remove();
        vex.closeAll();
        finishAllClosing();
    });

    it('the query dialog has role="dialog" and aria-label = widget.dn.dialogname', () => {
        dn._showCommentModal();

        expect(widget().getAttribute('role')).to.equal('dialog');
        expect(widget().getAttribute('aria-label')).to.equal(
            t('widget.dn.dialogname')
        );
    });

    it('it has no aria-modal attribute', () => {
        dn._showCommentModal();

        expect(widget().hasAttribute('aria-modal')).to.equal(false);
    });

    it('focus is inside the dialog after it opens', () => {
        dn._showCommentModal();
        expect(document.activeElement).to.equal(closeButton());
        dn._hideCommentModal(dn.linkedQuestion);

        dn.notes = dn._parseModelFromString(OPEN_THREAD);
        dn.threadNameMap = dn._generateThreadNameMap(dn.notes);
        dn._showCommentModal();
        expect(document.activeElement).to.equal(textarea());
    });

    it('the close button has the name "Close" and is reached by Tab', () => {
        dn._showCommentModal();
        const button = closeButton();

        expect(button.tagName).to.equal('BUTTON');
        expect(button.tabIndex).to.equal(0);
        expect(button.disabled).to.equal(false);
        expect(button.getAttribute('aria-label')).to.equal(t('alert.close'));
    });

    it('Tab does not leave the dialog', () => {
        openWithTextarea();
        const items = [
            ...widget().querySelectorAll(
                'button, input, select, textarea, a[href], [tabindex]'
            ),
        ].filter(
            (el) =>
                !el.disabled &&
                el.tabIndex >= 0 &&
                el.getClientRects().length > 0
        );
        const first = items[0];
        const last = items[items.length - 1];

        last.focus();
        let event = key(last, 'keydown', 'Tab');
        expect(event.defaultPrevented).to.equal(true);
        expect(document.activeElement).to.equal(first);

        event = key(first, 'keydown', 'Tab', { shiftKey: true });
        expect(event.defaultPrevented).to.equal(true);
        expect(document.activeElement).to.equal(last);

        // focus on no control of the dialog: Tab goes to the first control
        document.activeElement.blur();
        key(widget(), 'keydown', 'Tab');
        expect(document.activeElement).to.equal(first);
    });

    it('Escape (keydown then keyup) with an empty comment closes it and focuses the trigger', () => {
        openWithTextarea();
        escape(textarea());

        return tick().then(() => {
            expect(widget()).to.equal(null);
            expect(openDialogs().length).to.equal(0);
            expect(document.activeElement).to.equal(dn.commentButton);
        });
    });

    it('the Escape keyup does not reach the window listener of vex', () => {
        let reached = false;
        const listener = () => (reached = true);
        window.addEventListener('keyup', listener);
        openWithTextarea();
        escape(textarea());
        window.removeEventListener('keyup', listener);

        expect(reached).to.equal(false);
    });

    it('Escape with typed text asks first; "no" keeps the dialog and the text', () => {
        openWithTextarea();
        const input = textarea();
        input.value = 'typed';
        escape(input);

        expect(widget()).not.to.equal(null);
        expect(openDialogs().length).to.equal(1);
        expect(openDialogs()[0].textContent).to.include(
            t('widget.dn.discardcomment')
        );

        // Cancel is first (D13)
        openDialogs()[0].querySelectorAll('.vex-dialog-button')[0].click();
        finishAllClosing();

        return tick().then(() => {
            expect(widget()).not.to.equal(null);
            expect(input.value).to.equal('typed');
            expect(document.activeElement).to.equal(input);
        });
    });

    it('the discard prompt has Cancel first and focused, Confirm second', () => {
        openWithTextarea();
        textarea().value = 'typed';
        escape(textarea());

        const buttons = openDialogs()[0].querySelectorAll('.vex-dialog-button');

        expect(buttons.length).to.equal(2);
        expect(buttons[0].textContent).to.equal(t('confirm.default.negButton'));
        expect(buttons[1].textContent).to.equal(t('confirm.default.posButton'));
        expect(openDialogs()[0].classList.contains('vex-neg-first')).to.equal(
            true
        );
        expect(document.activeElement).to.equal(buttons[0]);
    });

    it('Escape with typed text and "yes" closes it', () => {
        openWithTextarea();
        textarea().value = 'typed';
        escape(textarea());

        openDialogs()[0].querySelectorAll('.vex-dialog-button')[1].click();

        return tick().then(() => {
            finishAllClosing();
            expect(widget()).to.equal(null);
            expect(document.activeElement).to.equal(dn.commentButton);
        });
    });

    it('the close button with typed text closes without asking (unchanged)', () => {
        openWithTextarea();
        textarea().value = 'typed';
        closeButton().click();

        expect(widget()).to.equal(null);
        expect(openDialogs().length).to.equal(0);
        expect(document.activeElement).to.equal(dn.commentButton);
    });

    describe('the query trigger', () => {
        const STATES = [
            ['', 'none'],
            ['new', 'new'],
            ['updated', 'updated'],
            ['closed', 'closed'],
            ['closed-modified', 'closed-modified'],
            ['invalid', 'invalid'],
        ];

        beforeEach(() => {
            // Use the markup the widget really inserts.
            const real = document
                .createRange()
                .createContextualFragment(Dn.COMMENT_BUTTON_HTML)
                .querySelector('a');
            dn.commentButton.replaceWith(real);
            dn.commentButton = real;
            dn._setCommentButtonHandler();
        });

        it('is an <a> with role="button" and no tabindex attribute', () => {
            expect(dn.commentButton.tagName).to.equal('A');
            expect(dn.commentButton.getAttribute('role')).to.equal('button');
            expect(dn.commentButton.hasAttribute('tabindex')).to.equal(false);
            expect(dn.commentButton.hasAttribute('type')).to.equal(false);
        });

        it('has aria-label "none" with no thread and "new" after state new', () => {
            dn._setCommentButtonState();
            expect(dn.commentButton.getAttribute('aria-label')).to.equal(
                t('widget.dn.trigger.none')
            );
            dn._setCommentButtonState('new');
            expect(dn.commentButton.getAttribute('aria-label')).to.equal(
                t('widget.dn.trigger.new')
            );
        });

        STATES.forEach(([state, key]) => {
            it(`has the label and class list for state "${key}"`, () => {
                dn._setCommentButtonState(state, false, false);
                expect(dn.commentButton.getAttribute('aria-label')).to.equal(
                    t(`widget.dn.trigger.${key}`)
                );
                expect(dn.commentButton.className).to.equal(
                    `btn-icon-only btn-comment btn-dn${
                        state ? ` ${state}` : ''
                    }`
                );
            });
        });

        it('keeps the multi and annotation classes', () => {
            dn._setCommentButtonState('new', true, true);
            expect(dn.commentButton.className).to.equal(
                'btn-icon-only btn-comment btn-dn new multi annotation'
            );
        });

        it('follows a language change', () => {
            dn._setCommentButtonState('updated');
            dn.commentButton.setAttribute('aria-label', 'stale');
            // i18next emits this after the UI language has switched.
            i18next.emit('languageChanged', 'de');
            expect(dn.commentButton.getAttribute('aria-label')).to.equal(
                t('widget.dn.trigger.updated')
            );
        });

        it('Space dispatches the same click as the mouse, Enter and others do not', () => {
            let clicks = 0;
            dn.commentButton.addEventListener('click', (e) => {
                e.preventDefault();
                clicks += 1;
            });
            const space = key(dn.commentButton, 'keydown', ' ');
            expect(clicks).to.equal(1);
            expect(space.defaultPrevented).to.equal(true);
            key(dn.commentButton, 'keydown', 'a');
            expect(clicks).to.equal(1);
        });

        it('a held Space (repeat) does not click again', () => {
            let clicks = 0;
            dn.commentButton.addEventListener('click', (e) => {
                e.preventDefault();
                clicks += 1;
            });
            key(dn.commentButton, 'keydown', ' ');
            const repeat = key(dn.commentButton, 'keydown', ' ', {
                repeat: true,
            });
            expect(clicks).to.equal(1);
            expect(repeat.defaultPrevented).to.equal(true);
        });
    });
});
