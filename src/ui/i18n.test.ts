import { afterEach, expect, it, vi } from "vitest";
import { message } from "./i18n.js";

afterEach(() => vi.unstubAllGlobals());

it("falls back to the semantic key when the browser has no message", () => {
  vi.stubGlobal("chrome", { i18n: { getMessage: () => "" } });
  expect(message("sendFeedbackLink")).toBe("sendFeedbackLink");
});
