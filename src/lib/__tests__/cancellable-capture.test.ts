import { describe, it, expect, vi, afterEach } from "vitest";
import { execa } from "execa";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

const mockExeca = vi.mocked(execa);

describe("captureRemotePaneContent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loadModule() {
    return await import("../remote.js");
  }

  it("returns a handle with promise and kill function", async () => {
    const killFn = vi.fn();
    mockExeca.mockReturnValue({
      then: (resolve: (v: { stdout: string }) => void) => {
        resolve({ stdout: "pane output" });
        return { then: (_: unknown, __: unknown) => ({ catch: vi.fn() }) };
      },
      kill: killFn,
    } as unknown as ReturnType<typeof execa>);

    const mod = await loadModule();
    const handle = mod.captureRemotePaneContent("host", "session", 10);

    expect(handle).toHaveProperty("promise");
    expect(handle).toHaveProperty("kill");
    expect(typeof handle.kill).toBe("function");
  });

  it("kills the SSH child process when kill() is called", async () => {
    const killFn = vi.fn();
    const pending = new Promise<{ stdout: string }>(() => {});
    // Make execa return a thenable with a kill method (simulating execa subprocess)
    const subprocess = Object.assign(pending, { kill: killFn }) as unknown as ReturnType<typeof execa>;
    mockExeca.mockReturnValue(subprocess);

    const mod = await loadModule();
    const handle = mod.captureRemotePaneContent("host", "session", 10);

    // Kill before the SSH response arrives
    handle.kill();

    expect(killFn).toHaveBeenCalledTimes(1);
  });

  it("resolves with trimmed stdout on success", async () => {
    const subprocess = Object.assign(
      Promise.resolve({ stdout: "  output lines  \n\n" }),
      { kill: vi.fn() },
    ) as unknown as ReturnType<typeof execa>;
    mockExeca.mockReturnValue(subprocess);

    const mod = await loadModule();
    const handle = mod.captureRemotePaneContent("host", "session", 10);
    const result = await handle.promise;

    expect(result).toBe("  output lines");
  });

  it("resolves with null on SSH failure", async () => {
    const subprocess = Object.assign(
      Promise.reject(new Error("Connection refused")),
      { kill: vi.fn() },
    ) as unknown as ReturnType<typeof execa>;
    mockExeca.mockReturnValue(subprocess);

    const mod = await loadModule();
    const handle = mod.captureRemotePaneContent("host", "session", 10);
    const result = await handle.promise;

    expect(result).toBeNull();
  });
});

describe("capturePaneContent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loadModule() {
    return await import("../tmux.js");
  }

  it("kills the local tmux child process when kill() is called", async () => {
    const killFn = vi.fn();
    const pending = new Promise<{ stdout: string }>(() => {});
    const subprocess = Object.assign(pending, { kill: killFn }) as unknown as ReturnType<typeof execa>;
    mockExeca.mockReturnValue(subprocess);

    const mod = await loadModule();
    const handle = mod.capturePaneContent("session", 10);

    handle.kill();

    expect(killFn).toHaveBeenCalledTimes(1);
  });

  it("resolves with trimmed stdout on success", async () => {
    const subprocess = Object.assign(
      Promise.resolve({ stdout: "local output\n\n" }),
      { kill: vi.fn() },
    ) as unknown as ReturnType<typeof execa>;
    mockExeca.mockReturnValue(subprocess);

    const mod = await loadModule();
    const handle = mod.capturePaneContent("session", 10);
    const result = await handle.promise;

    expect(result).toBe("local output");
  });

  it("resolves with null on tmux failure", async () => {
    const subprocess = Object.assign(
      Promise.reject(new Error("no session")),
      { kill: vi.fn() },
    ) as unknown as ReturnType<typeof execa>;
    mockExeca.mockReturnValue(subprocess);

    const mod = await loadModule();
    const handle = mod.capturePaneContent("session", 10);
    const result = await handle.promise;

    expect(result).toBeNull();
  });
});
