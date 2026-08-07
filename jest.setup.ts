import '@testing-library/jest-dom';

/**
 * `src/lib/env.ts` validates at import time, so every spec needs these present
 * before any module under test is loaded.
 */
process.env.NEXT_PUBLIC_API_BASE_URL ??= 'http://localhost:3001/api/v1';
process.env.API_BASE_URL ??= 'http://localhost:3001/api/v1';
process.env.NEXT_PUBLIC_API_TIMEOUT_MS ??= '15000';
process.env.NEXT_PUBLIC_APP_NAME ??= 'MovieFlix';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';

// jsdom implements neither; components under test use both.
if (typeof globalThis.matchMedia !== 'function') {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }),
  });
}

if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

/**
 * jsdom 20 ships `<dialog>` as an element but none of its methods, so any
 * component calling `showModal()` throws before it renders.
 *
 * This stands in for the parts our components actually depend on: the `open`
 * attribute, the `close` event, and Escape firing a cancelable `cancel` before
 * closing. It deliberately does *not* fake the top layer, focus trapping or
 * page inertness — those are the browser's job, and a test asserting on a
 * hand-rolled version of them would be testing this polyfill, not the app.
 */
if (typeof HTMLDialogElement === 'function' && !HTMLDialogElement.prototype.showModal) {
  const open = function (this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };

  HTMLDialogElement.prototype.show = open;
  HTMLDialogElement.prototype.showModal = open;
  HTMLDialogElement.prototype.close = function (returnValue?: string): void {
    this.removeAttribute('open');
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return;

    // A prevented `cancel` keeps the dialog open — that is how a component
    // blocks Escape while a request is in flight.
    if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) {
      (dialog as HTMLDialogElement).close();
    }
  });
}
