import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger } from "../log.js";

describe("Logger", () => {
  let tmpDir: string;
  let logFile: string;
  let logger: Logger;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "orchard-log-"));
    logFile = join(tmpDir, "debug.log");
    logger = new Logger({ dir: tmpDir, file: logFile });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("info", () => {
    it("writes an INFO line with ISO timestamp", () => {
      logger.info("hello world");

      const content = readFileSync(logFile, "utf-8");
      expect(content).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[INFO\] hello world\n$/
      );
    });
  });

  describe("warn", () => {
    it("writes a WARN line", () => {
      logger.warn("something fishy");

      const content = readFileSync(logFile, "utf-8");
      expect(content).toContain("[WARN] something fishy");
    });
  });

  describe("error", () => {
    it("writes an ERROR line", () => {
      logger.error("it broke");

      const content = readFileSync(logFile, "utf-8");
      expect(content).toContain("[ERROR] it broke");
    });
  });

  describe("multiple writes", () => {
    it("appends lines to the same file", () => {
      logger.info("first");
      logger.warn("second");
      logger.error("third");

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
      const nestedLogger = new Logger({ dir: nestedDir, file: nestedFile });

      nestedLogger.info("nested test");

      expect(existsSync(nestedDir)).toBe(true);
      expect(readFileSync(nestedFile, "utf-8")).toContain("nested test");
    });
  });

  describe("time / timeEnd", () => {
    it("writes elapsed time for a label", () => {
      logger.time("test-op");
      logger.timeEnd("test-op");

      const content = readFileSync(logFile, "utf-8");
      expect(content).toMatch(/\[INFO\] test-op: \d+\.\d+ms/);
    });

    it("ignores timeEnd without a matching time call", () => {
      logger.timeEnd("no-start");

      expect(existsSync(logFile)).toBe(false);
    });
  });

  describe("rotation", () => {
    it("rotates the log file when it exceeds 10MB", () => {
      mkdirSync(tmpDir, { recursive: true });
      const bigContent = "x".repeat(10 * 1024 * 1024 + 1);
      writeFileSync(logFile, bigContent);

      // New logger instance triggers rotation check on first write
      const freshLogger = new Logger({ dir: tmpDir, file: logFile });
      freshLogger.info("after rotation");

      const backupFile = logFile + ".1";
      expect(existsSync(backupFile)).toBe(true);

      const newContent = readFileSync(logFile, "utf-8");
      expect(newContent).toContain("after rotation");
      expect(newContent.length).toBeLessThan(1000);
    });
  });

  describe("file permissions", () => {
    it("creates log file with owner-only permissions", () => {
      logger.info("permission test");

      const stats = statSync(logFile);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });
});
