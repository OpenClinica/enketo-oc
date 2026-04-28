import config from 'enketo/config';
import loadForm from '../helpers/load-form';
import dialog from '../../src/js/fake-dialog';
import events from '../../src/js/event';

describe('calculate functionality', () => {
    /** @type {import('sinon').SinonSandbox} */
    let sandbox;

    /** @type {SinonFakeTimers} */
    let timers;

    /** @type {boolean} */
    let excludeNonRelevant;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        sandbox.stub(dialog, 'confirm').resolves(true);

        timers = sandbox.useFakeTimers(Date.now());

        excludeNonRelevant = false;

        sandbox
            .stub(config, 'excludeNonRelevant')
            .get(() => excludeNonRelevant);
    });

    afterEach(() => {
        timers.runAll();

        timers.clearTimeout();
        timers.clearInterval();
        timers.restore();
        sandbox.restore();
    });

    it('relevant calculations cascade from a view change', () => {
        const form = loadForm('calcs-cascade.xml');

        form.init();

        form.view.html.addEventListener(events.Change().type, () => {
            timers.tick(1);
        });

        const firstInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/first"]'
        );
        const secondInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/second"]'
        );
        const thirdInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/third"]'
        );
        const firstModel = form.model.xml.querySelector('first');
        const secondModel = form.model.xml.querySelector('second');
        const thirdModel = form.model.xml.querySelector('third');

        firstInput.value = 1;
        firstInput.dispatchEvent(events.Change());

        expect(firstInput.value).to.equal('1');
        expect(secondInput.value).to.equal('3');
        expect(thirdInput.value).to.equal('6');
        expect(firstModel.textContent).to.equal('1');
        expect(secondModel.textContent).to.equal('3');
        expect(thirdModel.textContent).to.equal('6');
    });

    it('relevant calculations cascade from a model change', () => {
        const form = loadForm('calcs-cascade.xml');

        form.init();

        const firstInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/first"]'
        );
        const secondInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/second"]'
        );
        const thirdInput = form.view.html.querySelector(
            'input[name="/calcs-cascade/third"]'
        );
        const firstModel = form.model.xml.querySelector('first');
        const secondModel = form.model.xml.querySelector('second');
        const thirdModel = form.model.xml.querySelector('third');

        firstInput.value = '1';
        form.model.node(firstInput.name).setVal('1');

        expect(firstInput.value).to.equal('1');
        expect(secondInput.value).to.equal('3');
        expect(thirdInput.value).to.equal('6');
        expect(firstModel.textContent).to.equal('1');
        expect(secondModel.textContent).to.equal('3');
        expect(thirdModel.textContent).to.equal('6');
    });

    it('updates inside multiple repeats when repeats become relevant', () => {
        const form = loadForm('repeat-relevant-calculate.xml');
        form.init();

        // This triggers a form.calc.update with this object: { relevantPath: '/data/rg' };
        form.view.$.find('[name="/data/yn"]')
            .prop('checked', true)
            .trigger('change');

        expect(
            form.model
                .node('/data/rg/row')
                .getElements()
                .map((node) => node.textContent)
                .join(',')
        ).to.equal('1,2,3');
        expect(form.view.$.find('[name="/data/rg/row"]')[0].value).to.equal(
            '1'
        );
        expect(form.view.$.find('[name="/data/rg/row"]')[1].value).to.equal(
            '2'
        );
        expect(form.view.$.find('[name="/data/rg/row"]')[2].value).to.equal(
            '3'
        );
    });

    it('updates inside multiple repeats a repeat is removed and position(..) changes', async () => {
        const form = loadForm('repeat-relevant-calculate.xml');
        form.init();

        form.view.$.find('[name="/data/yn"]')
            .prop('checked', true)
            .trigger('change');

        // remove first repeat to the calculation in both remaining repeats needs to be updated.
        form.view.html.querySelector('.btn.remove').click();

        await timers.runAllAsync();

        expect(
            form.model
                .node('/data/rg/row')
                .getElements()
                .map((node) => node.textContent)
                .join(',')
        ).to.equal('1,2');
        expect(form.view.$.find('[name="/data/rg/row"]')[0].value).to.equal(
            '1'
        );
        expect(form.view.$.find('[name="/data/rg/row"]')[1].value).to.equal(
            '2'
        );
    });

    it('updates a calculation for node if calc refers to node filtered with predicate', () => {
        const form = loadForm('count-repeated-nodes.xml');
        form.init();

        const text1 = form.view.html.querySelector(
            'textarea[name="/repeat-group-comparison/REP/text1"]'
        );

        text1.value = ' yes ';
        text1.dispatchEvent(events.Change());

        expect(
            form.view.html.querySelector(
                'input[name="/repeat-group-comparison/count2"]'
            ).value
        ).to.equal('1');
    });

    it('does not calculate questions inside repeat instances created with repeat-count, if the repeat is not relevant', () => {
        const form = loadForm('repeat-count-calculate-irrelevant.xml');
        form.init();

        const calcs = form.model.xml.querySelectorAll('SHD_NO');

        expect(calcs.length).to.equal(3);
        expect(calcs[0].textContent).to.equal('');
        expect(calcs[1].textContent).to.equal('');
        expect(calcs[2].textContent).to.equal('');
    });

    // This is important for OpenClinica, but also reduces unnecessary work. A calculation that runs upon form load and
    // doesn't change a default, or loaded, value doesn't have to populate the form control, as this will be done by setAllVals
    it('does not set the form control value if the calculation result does not change the value in the model', () => {
        const form = loadForm(
            'calc-control.xml',
            '<data><calc>12</calc></data>'
        );

        let counter = 0;

        form.view.html
            .querySelector('[name="/data/calc"]')
            .addEventListener(new events.InputUpdate().type, () => {
                counter += 1;
            });
        form.init();

        expect(counter).to.equal(0);
    });

    // https://github.com/OpenClinica/enketo-express-oc/issues/404#issuecomment-744743172
    // Checks whether different types of calculations are handled consistently when they become non-relevant
    it('consistently leaves calculated values if they become non-relevant', () => {
        const form = loadForm('relevant-calcs.xml');
        form.init();
        const grp = form.model.xml.querySelector('grp');

        expect(grp.textContent.replace(/\s/g, '')).to.equal('');

        const a = form.view.html.querySelector('input[name="/data/a"]');
        a.value = 'a';
        a.dispatchEvent(events.Change());

        expect(grp.textContent.replace(/\s/g, '')).to.equal('onetwothreefour');

        a.value = '';
        a.dispatchEvent(events.Change());

        // This should probably be '' for OC. However, this is longstanding behavior
        // so it is left as is.
        expect(grp.textContent.replace(/\s/g, '')).to.equal('onetwo');
    });

    describe('Excluding non-relevant nodes', () => {
        beforeEach(() => {
            excludeNonRelevant = true;
        });

        afterEach(() => {
            timers.runAll();
            timers.clearTimeout();
            timers.clearInterval();
            timers.restore();
        });

        it('recalculates non-relevant values when they are excluded from calculations', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });

            const grp = form.model.xml.querySelector('grp');

            expect(grp.textContent.replace(/\s/g, '')).to.equal('');

            const a = form.view.html.querySelector('input[name="/data/a"]');

            a.value = 'a';
            a.dispatchEvent(events.Change());

            expect(grp.textContent.replace(/\s/g, '')).to.equal(
                'onetwothreefour'
            );

            a.value = '';
            a.dispatchEvent(events.Change());

            expect(grp.textContent.replace(/\s/g, '')).to.equal('');
        });

        it('recalculates relevant values when they are restored', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });

            const grp = form.model.xml.querySelector('grp');

            expect(grp.textContent.replace(/\s/g, '')).to.equal('');

            const a = form.view.html.querySelector('input[name="/data/a"]');

            a.value = 'a';
            a.dispatchEvent(events.Change());

            expect(grp.textContent.replace(/\s/g, '')).to.equal(
                'onetwothreefour'
            );

            a.value = '';
            a.dispatchEvent(events.Change());

            a.value = 'a';
            a.dispatchEvent(events.Change());

            expect(grp.textContent.replace(/\s/g, '')).to.equal(
                'onetwothreefour'
            );
        });

        it('excludes children of non-relevant parents from calculations', () => {
            const form = loadForm('exclude-non-relevant-basic.xml', null);

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });

            const child = form.model.xml.querySelector('is-child-relevant');

            expect(child.textContent).to.equal('');

            const setsGroupRelevance = form.view.html.querySelector(
                'input[name="/data/sets-group-relevance"]'
            );
            const setsChildRelevance = form.view.html.querySelector(
                'input[name="/data/sets-child-relevance"]'
            );

            setsGroupRelevance.value = '1';
            setsGroupRelevance.dispatchEvent(events.Change());

            setsChildRelevance.value = '2';
            setsChildRelevance.dispatchEvent(events.Change());

            expect(child.textContent).to.equal('is relevant');

            setsGroupRelevance.value = '';
            setsGroupRelevance.dispatchEvent(events.Change());

            expect(child.textContent).to.equal('');
        });

        it('restores relevance of calculations of children of non-relevant when their parents become relevant', () => {
            const form = loadForm('exclude-non-relevant-basic.xml', null);

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });

            const child = form.model.xml.querySelector('is-child-relevant');

            expect(child.textContent).to.equal('');

            const setsGroupRelevance = form.view.html.querySelector(
                'input[name="/data/sets-group-relevance"]'
            );
            const setsChildRelevance = form.view.html.querySelector(
                'input[name="/data/sets-child-relevance"]'
            );

            setsGroupRelevance.value = '1';
            setsGroupRelevance.dispatchEvent(events.Change());

            setsChildRelevance.value = '2';
            setsChildRelevance.dispatchEvent(events.Change());

            expect(child.textContent).to.equal('is relevant');

            setsGroupRelevance.value = '';
            setsGroupRelevance.dispatchEvent(events.Change());

            setsGroupRelevance.value = '1';
            setsGroupRelevance.dispatchEvent(events.Change());

            expect(child.textContent).to.equal('is relevant');
        });

        // Note (2022/03/09): this behavior is currently inconsistent with JavaRosa
        it('recalculates when a non-relevant field becomes relevant', () => {
            const form = loadForm('exclude-non-relevant-basic.xml', null);

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });
            const now = form.model.xml.querySelector('now');

            const initialValue = new Date(now.textContent).getTime();

            expect(Number.isNaN(initialValue)).not.to.be.true;

            const toggleNow = form.view.html.querySelector(
                'input[name="/data/toggle-now"]'
            );

            toggleNow.value = '';
            toggleNow.dispatchEvent(events.Change());

            toggleNow.value = '1';
            toggleNow.dispatchEvent(events.Change());

            const recalculatedValue = new Date(now.textContent).getTime();

            expect(recalculatedValue).to.be.greaterThan(initialValue);
        });

        it('recalculates when a non-relevant group becomes relevant', () => {
            const form = loadForm('exclude-non-relevant-basic.xml', null);

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });
            const now = form.model.xml.querySelector('now-grouped now');

            const initialValue = new Date(now.textContent).getTime();

            expect(Number.isNaN(initialValue)).not.to.be.true;

            const toggleNow = form.view.html.querySelector(
                'input[name="/data/toggle-now"]'
            );

            toggleNow.value = '';
            toggleNow.dispatchEvent(events.Change());

            toggleNow.value = '1';
            toggleNow.dispatchEvent(events.Change());

            const recalculatedValue = new Date(now.textContent).getTime();

            expect(recalculatedValue).to.be.greaterThan(initialValue);
        });

        it('recalculates becoming relevant after becoming non-relevant', () => {
            const form = loadForm('exclude-non-relevant-basic.xml', null);

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });
            const computedByChild =
                form.model.xml.querySelector('computed-by-child');

            const initialValue = computedByChild.textContent;

            expect(initialValue).to.equal('');

            const setsGroupRelevance = form.view.html.querySelector(
                'input[name="/data/sets-group-relevance"]'
            );
            const setsChildRelevance = form.view.html.querySelector(
                'input[name="/data/sets-child-relevance"]'
            );

            setsGroupRelevance.value = '1';
            setsGroupRelevance.dispatchEvent(events.Change());

            setsChildRelevance.value = '2';
            setsChildRelevance.dispatchEvent(events.Change());

            expect(computedByChild.textContent).to.equal('is relevant');

            setsChildRelevance.value = '';
            setsChildRelevance.dispatchEvent(events.Change());

            expect(computedByChild.textContent).to.equal('');

            setsChildRelevance.value = '2';
            setsChildRelevance.dispatchEvent(events.Change());

            expect(computedByChild.textContent).to.equal('is relevant');
        });

        it('restores values set arbitrarily when a node becomes relevant', () => {
            const form = loadForm('exclude-non-relevant-basic.xml', null);

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });

            const assignAnyValue =
                form.model.xml.querySelector('assign-any-value');

            const initialValue = assignAnyValue.textContent;

            expect(initialValue).to.equal('');

            const setsRelevance = form.view.html.querySelector(
                'input[name="/data/sets-assign-any-value-relevance"]'
            );

            setsRelevance.value = '1';
            setsRelevance.dispatchEvent(events.Change());

            const assignAnyValueInput = form.view.html.querySelector(
                'input[name="/data/assign-any-value"]'
            );

            assignAnyValueInput.value = 'any value';
            assignAnyValueInput.dispatchEvent(events.Change());

            expect(assignAnyValue.textContent).to.equal('any value');

            setsRelevance.value = '';
            setsRelevance.dispatchEvent(events.Change());

            expect(assignAnyValue.textContent).to.equal('');

            setsRelevance.value = '1';
            setsRelevance.dispatchEvent(events.Change());

            expect(assignAnyValue.textContent).to.equal('any value');
        });

        it('updates recalculated values in the view', () => {
            const form = loadForm('exclude-non-relevant-basic.xml', null);

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });

            const assignAnyValue =
                form.model.xml.querySelector('assign-any-value');

            const initialValue = assignAnyValue.textContent;

            expect(initialValue).to.equal('');

            const setsRelevance = form.view.html.querySelector(
                'input[name="/data/sets-assign-any-value-relevance"]'
            );

            const calculated = form.view.html.querySelector(
                'input[name="/data/calc-by-assign-any-value"]'
            );

            expect(calculated.value).to.equal('');

            setsRelevance.value = '1';
            setsRelevance.dispatchEvent(events.Change());

            const assignAnyValueInput = form.view.html.querySelector(
                'input[name="/data/assign-any-value"]'
            );

            assignAnyValueInput.value = 'any value';
            assignAnyValueInput.dispatchEvent(events.Change());

            expect(calculated.value).to.equal('any value');

            setsRelevance.value = '';
            setsRelevance.dispatchEvent(events.Change());

            expect(calculated.value).to.equal('');

            setsRelevance.value = '1';
            setsRelevance.dispatchEvent(events.Change());

            expect(calculated.value).to.equal('any value');
        });

        it('clears non-relevant values of children of nested groups', () => {
            const form = loadForm('exclude-non-relevant-basic.xml', null);

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });

            const outerGroup = form.model.xml.querySelector(
                'is-outer-group-relevant'
            );
            const innerGroup = form.model.xml.querySelector(
                'is-inner-group-relevant'
            );
            const child = form.model.xml.querySelector(
                'child-without-direct-relevant-expression'
            );

            expect(outerGroup.textContent.trim()).to.equal('');
            expect(innerGroup.textContent.trim()).to.equal('');
            expect(child.textContent).to.equal('');

            const setsOuterRelevance = form.view.html.querySelector(
                'input[name="/data/sets-outer-group-relevance"]'
            );

            setsOuterRelevance.value = 'yes';
            setsOuterRelevance.dispatchEvent(events.Change());

            expect(outerGroup.textContent.trim()).to.equal('');
            expect(innerGroup.textContent.trim()).to.equal('');
            expect(child.textContent).to.equal('');

            const setsInnerRelevance = form.view.html.querySelector(
                'input[name="/data/sets-inner-group-relevance"]'
            );

            setsInnerRelevance.value = 'yes';
            setsInnerRelevance.dispatchEvent(events.Change());

            expect(outerGroup.textContent.trim()).to.equal('yes');
            expect(innerGroup.textContent.trim()).to.equal('yes');
            expect(child.textContent).to.equal('yes');

            setsInnerRelevance.value = 'no';
            setsInnerRelevance.dispatchEvent(events.Change());

            expect(outerGroup.textContent.trim()).to.equal('');
            expect(innerGroup.textContent.trim()).to.equal('');
            expect(child.textContent).to.equal('');

            setsInnerRelevance.value = 'yes';
            setsInnerRelevance.dispatchEvent(events.Change());

            expect(outerGroup.textContent.trim()).to.equal('yes');
            expect(innerGroup.textContent.trim()).to.equal('yes');
            expect(child.textContent).to.equal('yes');

            setsOuterRelevance.value = 'no';
            setsOuterRelevance.dispatchEvent(events.Change());

            expect(outerGroup.textContent.trim()).to.equal('');
            expect(innerGroup.textContent.trim()).to.equal('');
            expect(child.textContent).to.equal('');

            setsOuterRelevance.value = 'yes';
            setsOuterRelevance.dispatchEvent(events.Change());

            expect(outerGroup.textContent.trim()).to.equal('yes');
            expect(innerGroup.textContent.trim()).to.equal('yes');
            expect(child.textContent).to.equal('yes');

            setsOuterRelevance.value = 'no';
            setsOuterRelevance.dispatchEvent(events.Change());

            expect(outerGroup.textContent.trim()).to.equal('');
            expect(innerGroup.textContent.trim()).to.equal('');
            expect(child.textContent).to.equal('');

            setsOuterRelevance.value = 'yes';
            setsOuterRelevance.dispatchEvent(events.Change());

            expect(outerGroup.textContent.trim()).to.equal('yes');
            expect(innerGroup.textContent.trim()).to.equal('yes');
            expect(child.textContent).to.equal('yes');
        });

        it('does not recalculate unrelated questions when another field becomes non-relevant', () => {
            const form = loadForm('recalculations.xml');

            form.init();

            form.view.html.addEventListener(events.Change().type, () => {
                timers.tick(1);
            });

            const q1 = form.view.html.querySelector(
                'input[name="/recalculations/q1"]'
            );
            const q2 = form.view.html.querySelector(
                'input[name="/recalculations/q2"]'
            );
            const q3 = form.view.html.querySelector(
                'input[name="/recalculations/q3"]'
            );

            q1.value = '1';
            q1.dispatchEvent(events.Change());

            expect(q2.value).to.equal('7');

            q2.value = '8';
            q3.dispatchEvent(events.Change());

            const calculationUpdateSpy = sandbox.spy(form.calc, '_updateCalc');

            q3.value = '1';
            q3.dispatchEvent(events.Change());

            expect(calculationUpdateSpy).not.to.have.been.calledWith(q2);
            expect(q2.value).to.equal('8');
        });
    });

    describe('function', () => {
        it('_isRelevant() determines relevancy correctly', () => {
            const form = loadForm('relevant-calcs.xml', null);

            form.init();
            const props = {
                name: '/data/grp/four',
                expr: "if( /data/a  != 'ignore', concat('fo', 'ur'), 'ignore')",
                dataType: 'string',
                index: 0,
            };

            expect(form.calc._isRelevant(props)).to.equal(false);

            const a = form.view.html.querySelector('input[name="/data/a"]');

            a.value = 'a';
            a.dispatchEvent(events.Change());

            expect(form.calc._isRelevant(props)).to.equal(true);
        });
    });

    describe('inside a jr:count-controlled repeat with indexed-repeat() outside', () => {
        /**
         * Regression test for the bug where calculations that depend on
         * repeat instances created by jr:count were not evaluated before
         * output.init() / itemset.init() ran.
         *
         * The form has:
         *   - A secondary instance with 4 specimen IDs ('sp1'..'sp4')
         *   - spec_count = count of items in secondary instance (= 4)
         *   - spec_repeat: jr:count-controlled repeat (creates 4 instances)
         *   - specimen_id_calc[i] inside the repeat: looks up the Nth item via position(..)
         *   - spec_id1..spec_id4 = indexed-repeat(specimen_id_calc, spec_repeat, N), relevant spec_count >= N
         *   - A select_one whose itext option labels use or-output referencing spec_id1..spec_id4
         *
         * Before the fix, specimen_id_calc[1..3] (instances 2-4) had not been evaluated
         * by the time output.init() / itemset.init() built option labels, causing
         * spec_id2..spec_id4 to be empty and those option labels to render as blank.
         */
        it('resolves all indexed-repeat() calculations before itemset labels are built', () => {
            const form = loadForm('repeat-count-indexed-repeat-calc.xml');
            form.init();

            // Model values must be correct for all four indexed-repeat() calculations
            expect(form.model.node('/data/spec_id1').getVal()).to.equal('sp1');
            expect(form.model.node('/data/spec_id2').getVal()).to.equal('sp2');
            expect(form.model.node('/data/spec_id3').getVal()).to.equal('sp3');
            expect(form.model.node('/data/spec_id4').getVal()).to.equal('sp4');

            // All four option labels (driven by spec_id1..spec_id4 via or-output)
            // must be non-empty and show the correct values on initial load.
            const optionLabels = form.view.html.querySelectorAll(
                '[name="/data/specimen_select"]+.option-label.active'
            );
            expect(optionLabels.length).to.equal(4);
            expect(optionLabels[0].textContent.trim()).to.equal('sp1');
            expect(optionLabels[1].textContent.trim()).to.equal('sp2');
            expect(optionLabels[2].textContent.trim()).to.equal('sp3');
            expect(optionLabels[3].textContent.trim()).to.equal('sp4');
        });
    });
});
