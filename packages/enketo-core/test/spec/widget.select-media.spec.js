import Mediapicker from '../../src/widget/select-media/select-media';
import { testStaticProperties } from '../helpers/test-widget';

testStaticProperties(Mediapicker);

const FORM = `<fieldset class="question or-appearance-columns-2 or-appearance-no-buttons ">
        <fieldset>
            <legend>
                <span lang="" class="question-label active">Label</span>
            </legend>
            <div class="option-wrapper">
                <label class="">
                    <input type="radio" name="/widgets/select_widgets/grid_2_columns" data-name="/widgets/select_widgets/grid_2_columns" value="a" data-type-xml="select1">
                    <span lang="default" class="option-label active">some option label</span>
                    <img lang="default" class="active" src="/media/get/https/api.ona.io/enketo/xformsMedia/68781/139078.jpg" alt="">
                </label>
                <label class=""><input type="radio" name="/widgets/select_widgets/grid_2_columns" data-name="/widgets/select_widgets/grid_2_columns" value="b" data-type-xml="select1">
                    <span lang="default" class="option-label active">some option label</span>
                    <img lang="default" class="active" src="/media/get/https/api.ona.io/enketo/xformsMedia/68781/139079.jpg" alt="">
                </label>
            </div>
        </fieldset>
    </fieldset>`;

describe('custom tests for media picker re.', () => {
    const init = (html = FORM) => {
        const question = document
            .createRange()
            .createContextualFragment(html)
            .querySelector('.question');
        document.body.appendChild(question);
        new Mediapicker(question);
        return question;
    };

    afterEach(() => {
        document.querySelectorAll('.question').forEach((q) => q.remove());
    });

    it('visually hides the text label, without display:none', () => {
        const question = init();
        question.querySelectorAll('span.option-label').forEach((label) => {
            expect(label.style.display).to.equal('');
            expect(label.style.position).to.equal('absolute');
            expect(label.style.clip).to.contain('rect(0px, 0px, 0px, 0px)');
            expect(label.style.getPropertyPriority('position')).to.equal(
                'important'
            );
            expect(label.getBoundingClientRect().width).to.be.at.most(1);
        });
    });

    it('keeps the label text in the DOM and exposed to assistive technology', () => {
        const question = init();
        const label = question.querySelector('label');
        expect(label.querySelector('.option-label').textContent).to.equal(
            'some option label'
        );
        expect(label.closest('[aria-hidden="true"]')).to.equal(null);
        expect(
            label.querySelector('.option-label').hasAttribute('aria-hidden')
        ).to.equal(false);
    });

    it('leaves options without media untouched', () => {
        const question = init(FORM.replace(/<img[^>]*>/g, ''));
        question.querySelectorAll('span.option-label').forEach((label) => {
            expect(label.getAttribute('style')).to.equal(null);
        });
    });
});
