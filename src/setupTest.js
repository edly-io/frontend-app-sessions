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

// jsdom ships no matchMedia. react-responsive uses it to resolve breakpoints,
// so the mobile/desktop branches of responsive layouts can decide which one to
// render during tests. Default window.innerWidth in jsdom is 1024, so queries
// like `(min-width: 992px)` return true and the desktop branch renders.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query) => {
    const minMatch = /\(min-width:\s*(\d+)px\)/.exec(query);
    const maxMatch = /\(max-width:\s*(\d+)px\)/.exec(query);
    let matches = true;
    if (minMatch) { matches = matches && window.innerWidth >= Number(minMatch[1]); }
    if (maxMatch) { matches = matches && window.innerWidth <= Number(maxMatch[1]); }
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };
}
