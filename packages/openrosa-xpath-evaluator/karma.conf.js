const puppeteer = require('puppeteer');

/* eslint-env node */
module.exports = function (config) {
    process.env.CHROME_BIN = puppeteer.executablePath();
    process.env.TZ = 'America/Phoenix';
    config.set({
        frameworks: ['mocha'],
        browsers: ['ChromeHeadless', 'FirefoxHeadless'],
        // Add --no-sandbox flag to ChromeHeadless to support running in restricted/container environments.
        customLaunchers: {
            ChromeHeadless: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox'],
            },
        },
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
