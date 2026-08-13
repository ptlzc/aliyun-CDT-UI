import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView; components that auto-scroll a
// terminal or list would crash in tests without this minimal stub.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
