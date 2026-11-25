import { t } from 'enketo/translator';
import Geopicker from '../../src/widget/geo/geopicker';
import {
    createTestCoordinates,
    mockGetCurrentPosition,
} from '../helpers/geolocation';
import loadForm from '../helpers/load-form';
import support from '../../src/js/support';
import { runAllCommonWidgetTests } from '../helpers/test-widget';

const FORM = `<form class="or">
        <label class="question">
            <input name="/data/geo" type="text" data-type-xml="geoshape"/>
        </label>
    </form>`;
const SHAPE =
    '7.9377 -11.5845 0 0;7.9324 -11.5902 0 0;7.927 -11.5857 0 0;7.9377 -11.5845 0 0';

runAllCommonWidgetTests(Geopicker, FORM, SHAPE);

describe('geopicker button names', () => {
    const create = () => {
        const fragment = document.createRange().createContextualFragment(FORM);
        const picker = new Geopicker(fragment.querySelector('input'));
        return picker.$widget[0];
    };
    const names = (widget) => [
        widget.querySelector('.search-btn').getAttribute('aria-label'),
        widget
            .querySelector('button[name="geodetect"]')
            .getAttribute('aria-label'),
        widget.querySelector('button[name="geodetect"]').title,
    ];

    it('the search and detect buttons are named from t()', () => {
        expect(names(create())).to.deep.equal([
            t('geopicker.search'),
            t('geopicker.detect'),
            t('geopicker.detect'),
        ]);
    });

    it('_setButtonNames restores the names (UI language refresh)', () => {
        const fragment = document.createRange().createContextualFragment(FORM);
        const picker = new Geopicker(fragment.querySelector('input'));
        const widget = picker.$widget[0];
        widget.querySelector('.search-btn').setAttribute('aria-label', 'x');
        widget.querySelector('button[name="geodetect"]').title = 'x';
        widget
            .querySelector('button[name="geodetect"]')
            .setAttribute('aria-label', 'x');
        picker._setButtonNames();
        expect(names(widget)).to.deep.equal([
            t('geopicker.search'),
            t('geopicker.detect'),
            t('geopicker.detect'),
        ]);
    });

    describe('full-screen map (touch, appearance "maps")', () => {
        let form;
        let picker;
        let sandbox;
        const widget = () => picker.$widget[0];

        beforeEach(() => {
            sandbox = sinon.createSandbox();
            sandbox.stub(support, 'touch').value(true);
            // No map library in this test: only the buttons are checked.
            sandbox.stub(Geopicker.prototype, '_updateMap');
            form = document
                .createRange()
                .createContextualFragment(
                    FORM.replace('"question"', '"question or-appearance-maps"')
                )
                .querySelector('form');
            document.body.append(form);
            picker = new Geopicker(form.querySelector('input'));
        });

        afterEach(() => {
            form.remove();
            sandbox.restore();
        });

        it('the back button is named "Close map", also after _setButtonNames', () => {
            const back = widget().querySelector('.hide-map-btn');
            expect(back.getAttribute('aria-label')).to.equal(
                t('geopicker.closemap')
            );
            back.setAttribute('aria-label', 'x');
            picker._setButtonNames();
            expect(back.getAttribute('aria-label')).to.equal(
                t('geopicker.closemap')
            );
        });

        it('Map moves focus to the back button, and back returns it to Map', () => {
            const map = widget().querySelector('.show-map-btn');
            const back = widget().querySelector('.hide-map-btn');

            map.focus();
            map.click();
            expect(document.activeElement).to.equal(back);

            back.click();
            expect(document.activeElement).to.equal(map);
        });
    });
});

describe('geoshape widget', () => {
    let geoshapePicker;

    beforeEach(() => {
        const fragment = document.createRange().createContextualFragment(FORM);
        const control = fragment.querySelector('input');
        geoshapePicker = new Geopicker(control);
    });

    mockGetCurrentPosition(
        createTestCoordinates({
            latitude: 48.66,
            longitude: -120.5,
            accuracy: 2500.12,
            altitude: 123,
        })
    );

    describe('KML to Leaflet conversion', () => {
        const kmlCoordinates =
            '81.601884,44.160723 83.529902,43.665148 82.947737,44.248831 81.509322,44.321015';
        const a = {
            kml: `<coordinates>${kmlCoordinates}</coordinates>`,
            result: [
                [44.160723, 81.601884],
                [43.665148, 83.529902],
                [44.248831, 82.947737],
                [44.321015, 81.509322],
            ],
        };
        const b = {
            kml: '<coordinates>   11.111,22.222 33.333,44.444  </coordinates>',
            result: [
                [22.222, 11.111],
                [44.444, 33.333],
            ],
        };
        const gobbledigook = '<something< notquite </right>';

        it('works for space-separated KML <coordinates>', () => {
            expect(
                geoshapePicker._convertKmlCoordinatesToLeafletCoordinates(a.kml)
            ).to.deep.equal(a.result);
        });

        it('works for newline-separated KML <coordinates>', () => {
            expect(
                geoshapePicker._convertKmlCoordinatesToLeafletCoordinates(
                    a.kml.replace(' ', '\n')
                )
            ).to.deep.equal(a.result);
        });

        it('ignores gobbledigook outside of <coordinates>', () => {
            expect(
                geoshapePicker._convertKmlCoordinatesToLeafletCoordinates(
                    a.kml + gobbledigook
                )
            ).to.deep.equal(a.result);
            expect(
                geoshapePicker._convertKmlCoordinatesToLeafletCoordinates(
                    gobbledigook + a.kml
                )
            ).to.deep.equal(a.result);
        });

        it('only extracts the values of the first <coordinates> if multiple are present', () => {
            expect(
                geoshapePicker._convertKmlCoordinatesToLeafletCoordinates(
                    a.kml + b.kml
                )
            ).to.deep.equal(a.result);
            expect(
                geoshapePicker._convertKmlCoordinatesToLeafletCoordinates(
                    b.kml + a.kml
                )
            ).to.deep.equal(b.result);
            expect(
                geoshapePicker._convertKmlCoordinatesToLeafletCoordinates(
                    gobbledigook + b.kml + gobbledigook + a.kml + gobbledigook
                )
            ).to.deep.equal(b.result);
        });

        it('works for the content of a single <coordinates> without the tags', () => {
            expect(
                geoshapePicker._convertKmlCoordinatesToLeafletCoordinates(
                    kmlCoordinates
                )
            ).to.deep.equal(a.result);
        });
    });

    it('does not load a geopicker widget for setvalue references within an input', () => {
        const form = loadForm('setvalue-setgeopoint-geopoint.xml');

        form.init();

        const geopickers = form.view.html.querySelectorAll(
            '[name="/data/rpt/foo"] ~ .geopicker'
        );

        expect(geopickers.length).to.equal(0);
    });

    it('does not load a geopicker widget for setgeopoint references within an input', () => {
        const form = loadForm('setvalue-setgeopoint-geopoint.xml');

        form.init();

        const geopickers = form.view.html.querySelectorAll(
            '[name="/data/rpt/bar"] ~ .geopicker'
        );

        expect(geopickers.length).to.equal(0);
    });
});
