import { appendFileSync, mkdirSync, statSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Level = "INFO" | "WARN" | "ERROR";

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

let logDir = join(homedir(), ".local", "state", "git-orchard");
let logFile = join(logDir, "debug.log");
let dirReady = false;

const timers = new Map<string, number>();

function ensureDir(): void {
  if (dirReady) return;
  try {
    mkdirSync(logDir, { recursive: true });
    dirReady = true;
  } catch {
    // If we can't create the dir, logging silently fails
  }
}

function rotate(): void {
  try {
    const stats = statSync(logFile);
    if (stats.size > MAX_LOG_SIZE) {
      renameSync(logFile, logFile + ".1");
    }
  } catch {
    // File doesn't exist yet — nothing to rotate
  }
}

let rotateChecked = false;

function write(level: Level, message: string): void {
  ensureDir();
  if (!dirReady) return;

  if (!rotateChecked) {
    rotate();
    rotateChecked = true;
  }

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;

  try {
    appendFileSync(logFile, line);
  } catch {
    // Logging should never crash the app
  }
}

export const log = {
  info(message: string): void {
    write("INFO", message);
  },

  warn(message: string): void {
    write("WARN", message);
  },

  error(message: string): void {
    write("ERROR", message);
  },

  time(label: string): void {
    timers.set(label, performance.now());
  },

  timeEnd(label: string): void {
    const start = timers.get(label);
    if (start === undefined) return;
    timers.delete(label);
    const elapsed = performance.now() - start;
    write("INFO", `${label}: ${elapsed.toFixed(1)}ms`);
  },

  /** Override log path for testing. Returns a restore function. */
  _setPath(dir: string, file: string): () => void {
    const prevDir = logDir;
    const prevFile = logFile;
    const prevReady = dirReady;
    const prevRotateChecked = rotateChecked;

    logDir = dir;
    logFile = file;
    dirReady = false;
    rotateChecked = false;
    timers.clear();

    return () => {
      logDir = prevDir;
      logFile = prevFile;
      dirReady = prevReady;
      rotateChecked = prevRotateChecked;
      timers.clear();
    };
  },
};
