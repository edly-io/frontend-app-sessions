import 'core-js/stable';
import 'regenerator-runtime/runtime';
// jest-dom v6 requires explicit extend in this babel-jest environment
const jestDomMatchers = require('@testing-library/jest-dom/matchers'); // eslint-disable-line
expect.extend(jestDomMatchers); // eslint-disable-line no-undef

// Paragon's `Tabs` constructs a ResizeObserver to measure its strip, and
// jsdom has none — so any suite rendering a page with tabs needs this.
class ResizeObserverStub { // eslint-disable-line class-methods-use-this
  observe() {} // eslint-disable-line class-methods-use-this

  unobserve() {} // eslint-disable-line class-methods-use-this

  disconnect() {} // eslint-disable-line class-methods-use-this
}

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = ResizeObserverStub; // eslint-disable-line no-undef
}
