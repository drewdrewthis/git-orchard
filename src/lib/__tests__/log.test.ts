import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { log } from "../log.js";

describe("log", () => {
  let tmpDir: string;
  let logFile: string;
  let restore: () => void;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "orchard-log-"));
    logFile = join(tmpDir, "debug.log");
    restore = log._setPath(tmpDir, logFile);
  });

  afterEach(() => {
    restore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("info", () => {
    it("writes an INFO line with ISO timestamp", () => {
      log.info("hello world");

      const content = readFileSync(logFile, "utf-8");
      expect(content).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[INFO\] hello world\n$/
      );
    });
  });

  describe("warn", () => {
    it("writes a WARN line", () => {
      log.warn("something fishy");

      const content = readFileSync(logFile, "utf-8");
      expect(content).toContain("[WARN] something fishy");
    });
  });

  describe("error", () => {
    it("writes an ERROR line", () => {
      log.error("it broke");

      const content = readFileSync(logFile, "utf-8");
      expect(content).toContain("[ERROR] it broke");
    });
  });

  describe("multiple writes", () => {
    it("appends lines to the same file", () => {
      log.info("first");
      log.warn("second");
      log.error("third");

      const lines = readFileSync(logFile, "utf-8").trim().split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain("[INFO] first");
      expect(lines[1]).toContain("[WARN] second");
      expect(lines[2]).toContain("[ERROR] third");
    });
  });

  describe("directory creation", () => {
    it("creates the log directory if it does not exist", () => {
      const nestedDir = join(tmpDir, "nested", "deep");
      const nestedFile = join(nestedDir, "debug.log");
      const restoreNested = log._setPath(nestedDir, nestedFile);

      log.info("nested test");

      expect(existsSync(nestedDir)).toBe(true);
      expect(readFileSync(nestedFile, "utf-8")).toContain("nested test");
      restoreNested();
    });
  });

  describe("time / timeEnd", () => {
    it("writes elapsed time for a label", () => {
      log.time("test-op");
      log.timeEnd("test-op");

      const content = readFileSync(logFile, "utf-8");
      expect(content).toMatch(/\[INFO\] test-op: \d+\.\d+ms/);
    });

    it("ignores timeEnd without a matching time call", () => {
      log.timeEnd("no-start");

      expect(existsSync(logFile)).toBe(false);
    });
  });

  describe("rotation", () => {
    it("rotates the log file when it exceeds 10MB", () => {
      // Create a file just over 10MB
      mkdirSync(tmpDir, { recursive: true });
      const bigContent = "x".repeat(10 * 1024 * 1024 + 1);
      writeFileSync(logFile, bigContent);

      // Reset path to trigger rotation check on next write
      restore();
      restore = log._setPath(tmpDir, logFile);

      log.info("after rotation");

      const backupFile = logFile + ".1";
      expect(existsSync(backupFile)).toBe(true);

      const newContent = readFileSync(logFile, "utf-8");
      expect(newContent).toContain("after rotation");
      expect(newContent.length).toBeLessThan(1000);
    });
  });
});
