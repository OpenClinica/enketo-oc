const puppeteer = require('puppeteer');

/* eslint-env node */
module.exports = function (config) {
    process.env.CHROME_BIN = puppeteer.executablePath();
    process.env.TZ = 'America/Phoenix';
    config.set({
        frameworks: ['mocha'],
        customLaunchers: {
            ChromeHeadlessNoSandbox: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
        },
        // Ubuntu 24.04 runners block the Chrome sandbox (AppArmor userns).
        browsers: [
            process.env.GITHUB_ACTIONS
                ? 'ChromeHeadlessNoSandbox'
                : 'ChromeHeadless',
            'FirefoxHeadless',
        ],
        files: [{ pattern: 'test/integration/index.js', watched: false }],
        preprocessors: {
            'test/integration/index.js': ['webpack'],
        },
        webpack: {
            mode: 'development',
            devtool: false,
        },
    });
};
