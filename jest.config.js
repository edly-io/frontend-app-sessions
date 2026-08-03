const { createConfig } = require('@openedx/frontend-build');

const config = createConfig('jest', {
  // setupFilesAfterEnv is used after the jest environment has been loaded. In general this is what you want.
  // If you want to add config BEFORE jest loads, use setupFiles instead.
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTest.js',
  ],
  coveragePathIgnorePatterns: [
    'src/setupTest.js',
    'src/i18n',
  ],
});

// @edly-io ships ESM (like @openedx/paragon), so Babel must transpile it for Jest.
// createConfig merges via webpack-merge, which *concatenates* arrays — appending
// here would leave the base preset's `(?!@(open)?edx)` pattern in place and it
// would still ignore @edly-io. Replace the key outright to add @edly-io to the
// allowlist while keeping @openedx/@edx covered.
config.transformIgnorePatterns = ['/node_modules/(?!(@openedx|@edx|@edly-io))'];

module.exports = config;
