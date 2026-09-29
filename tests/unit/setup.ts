import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom은 <dialog>의 showModal/close를 구현하지 않는다. 테스트에 필요한 만큼만 흉내 낸다.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    // 브라우저처럼 close 이벤트를 비동기로 보낸다.
    setTimeout(() => this.dispatchEvent(new Event("close")));
  };
}

// jsdom에는 matchMedia가 없다. 항상 "일치하지 않음"으로 답한다.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  cleanup();
  // 서버 모듈 테스트는 `@vitest-environment node`로 돌아 localStorage가 없다.
  globalThis.localStorage?.clear();
  globalThis.sessionStorage?.clear();
});
