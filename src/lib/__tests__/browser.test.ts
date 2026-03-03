import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { openUrl } from "../browser.js";
import { execa } from "execa";

const mockedExeca = vi.mocked(execa);

describe("openUrl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls open on macOS", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });
    mockedExeca.mockReturnValue(Promise.resolve({}) as never);

    openUrl("https://example.com");

    expect(mockedExeca).toHaveBeenCalledWith("open", ["https://example.com"]);
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("calls xdg-open on linux", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });
    mockedExeca.mockReturnValue(Promise.resolve({}) as never);

    openUrl("https://example.com");

    expect(mockedExeca).toHaveBeenCalledWith("xdg-open", ["https://example.com"]);
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("does not throw when command fails", () => {
    mockedExeca.mockReturnValue(Promise.reject(new Error("no browser")) as never);

    expect(() => openUrl("https://example.com")).not.toThrow();
  });
});
