const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const styles = path.resolve(__dirname, '../../app/views/styles');
const tokenSource = fs.readFileSync(
    path.join(styles, 'component/_oc-tokens.scss'),
    'utf8'
);
const mapBody = tokenSource.match(/\$oc-tokens:\s*\(([\s\S]*?)\)\s*;/)[1];
const tokens = {};
[...mapBody.matchAll(/['"]?([a-z-]+)['"]?\s*:\s*(#[0-9a-fA-F]{6})/g)].forEach(
    ([, name, value]) => {
        tokens[name] = value.toLowerCase();
    }
);

// WCAG relative-luminance contrast ratio (sources/contrast.py)
const lum = (hex) => {
    const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
};

const backgrounds = [
    '#ffffff', // white
    '#f0f0f0', // page
    '#eeeeee', // disabled input
    '#f2dede', // invalid question
    '#fcd4b2', // strict question
    '#fde2cb', // option hover
    '#f1f1f1', // reason-for-change panel
    '#e4e4e4', // query list
];

const expectRatio = (fg, bgs, min) =>
    bgs.forEach((bg) => {
        expect(ratio(fg, bg), `${fg} on ${bg}`).to.be.at.least(min);
    });

describe('OC tokens', () => {
    it('every token equals its Token Table value', () => {
        expect(tokens).to.deep.equal({
            accent: '#994a07',
            'accent-hover': '#7a3b06',
            'input-border': '#7c7c7c',
            'secondary-text': '#606060',
            error: '#a2413f',
            focus: '#1e80ce',
            'query-new': '#fa0000',
            'icon-muted': '#8a8a8a',
            'jump-nav-text': '#1b1b1b',
        });
    });

    it('accent, secondary-text and error reach 4.5 on white, #f0f0f0, #f2dede, #fcd4b2', () => {
        const bgs = ['#ffffff', '#f0f0f0', '#f2dede', '#fcd4b2'];
        ['accent', 'secondary-text', 'error'].forEach((n) =>
            expectRatio(tokens[n], bgs, 4.5)
        );
    });

    it('white text on accent and accent-hover reaches 4.5', () => {
        expectRatio('#ffffff', [tokens.accent, tokens['accent-hover']], 4.5);
    });

    it('input-border, focus and query-new reach 3 on all eight backgrounds', () => {
        ['input-border', 'focus', 'query-new'].forEach((n) =>
            expectRatio(tokens[n], backgrounds, 3)
        );
    });

    it('icon-muted reaches 3 on white and #f0f0f0', () => {
        expectRatio(tokens['icon-muted'], ['#ffffff', '#f0f0f0'], 3);
    });

    describe('other themes', () => {
        const before = process.env.OC_CSS_BEFORE;
        ['theme-kobo', 'theme-plain'].forEach((theme) => {
            ['css', 'print.css'].forEach((ext) => {
                const file = `${theme}.${ext}`;
                (before ? it : it.skip)(`${file} equals the file in OC_CSS_BEFORE`, () => {
                    const built = fs.readFileSync(
                        path.resolve(__dirname, '../../public/css', file)
                    );
                    expect(built.equals(fs.readFileSync(path.join(before, file)))).to.equal(true);
                });
            });
        });
    });
});
