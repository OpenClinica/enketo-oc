const puppeteer = require('puppeteer');

/* eslint-env node */
module.exports = function (config) {
    process.env.CHROME_BIN = puppeteer.executablePath();
    process.env.TZ = 'America/Phoenix';
    config.set({
        frameworks: ['mocha'],
        files: [{ pattern: 'test/integration/index.js', watched: false }],
        preprocessors: {
            'test/integration/index.js': ['webpack'],
        },
        webpack: {
            mode: 'development',
            devtool: false,
        },
        // Use a custom Chrome launcher with no-sandbox to avoid sandbox issues in CI/Docker.
        customLaunchers: {
            ChromeHeadlessNoSandbox: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
        },
        browsers: process.env.GITHUB_ACTIONS
            ? ['ChromeHeadlessNoSandbox', 'FirefoxHeadless']
            : ['ChromeHeadless', 'FirefoxHeadless'],
    });
};
