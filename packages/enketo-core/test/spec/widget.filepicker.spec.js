import Filepicker from '../../src/widget/file/filepicker';
import { runAllCommonWidgetTests } from '../helpers/test-widget';

const FORM = `<form class="or">
        <label class="question">
            <input name="/data/d" type="file" data-type-xml="binary" />
        </label>
        <input />
    </form>`;

runAllCommonWidgetTests(Filepicker, FORM, '');

describe('filepicker preview', () => {
    it('the preview image alt is the file name', () => {
        const el = document
            .createRange()
            .createContextualFragment(FORM)
            .querySelector('input');
        const widget = new Filepicker(el);
        widget.preview = document.createElement('div');
        widget._showPreview('blob:x', 'image/*', 'photo.png');
        expect(widget.preview.querySelector('img').alt).to.equal('photo.png');
    });
});
