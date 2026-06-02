import 'core-js/stable';
import 'regenerator-runtime/runtime';
// jest-dom v6 requires explicit extend in this babel-jest environment
const jestDomMatchers = require('@testing-library/jest-dom/matchers'); // eslint-disable-line
expect.extend(jestDomMatchers); // eslint-disable-line no-undef
