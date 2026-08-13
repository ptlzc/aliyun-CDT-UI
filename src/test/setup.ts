import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView; components that auto-scroll a
// terminal or list would crash in tests without this minimal stub.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// react-router 7.17+ drives navigation state through document.startViewTransition
// when available. jsdom does not implement it; stub a minimal compliant object
// so router state updates (location/params) propagate normally in tests.
if (!document.startViewTransition) {
  document.startViewTransition = (callback) => {
    const finished = Promise.resolve();
    void callback?.();
    return {
      finished,
      ready: finished,
      updateCallbackDone: finished,
      skipTransition: () => {},
      types: new Set(),
    } as unknown as ViewTransition;
  };
}
