import {
  appendFileSync,
  mkdirSync,
  statSync,
  renameSync,
  chmodSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Level = "INFO" | "WARN" | "ERROR";

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const FILE_MODE = 0o600; // owner read/write only

export interface LoggerOptions {
  dir: string;
  file: string;
}

export class Logger {
  private readonly dir: string;
  private readonly file: string;
  private dirReady = false;
  private rotateChecked = false;
  private readonly timers = new Map<string, number>();

  constructor(options: LoggerOptions) {
    this.dir = options.dir;
    this.file = options.file;
  }

  info(message: string): void {
    this.write("INFO", message);
  }

  warn(message: string): void {
    this.write("WARN", message);
  }

  error(message: string): void {
    this.write("ERROR", message);
  }

  time(label: string): void {
    this.timers.set(label, performance.now());
  }

  timeEnd(label: string): void {
    const start = this.timers.get(label);
    if (start === undefined) return;
    this.timers.delete(label);
    const elapsed = performance.now() - start;
    this.write("INFO", `${label}: ${elapsed.toFixed(1)}ms`);
  }

  private write(level: Level, message: string): void {
    this.ensureDir();
    if (!this.dirReady) return;

    if (!this.rotateChecked) {
      this.rotate();
      this.rotateChecked = true;
    }

    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}\n`;

    try {
      appendFileSync(this.file, line, { mode: FILE_MODE });
    } catch {
      // Logging should never crash the app
    }
  }

  private ensureDir(): void {
    if (this.dirReady) return;
    try {
      mkdirSync(this.dir, { recursive: true });
      this.dirReady = true;
    } catch {
      // If we can't create the dir, logging silently fails
    }
  }

  private rotate(): void {
    try {
      const stats = statSync(this.file);
      if (stats.size > MAX_LOG_SIZE) {
        renameSync(this.file, this.file + ".1");
        chmodSync(this.file + ".1", FILE_MODE);
      }
    } catch {
      // File doesn't exist yet — nothing to rotate
    }
  }
}

const defaultDir = join(homedir(), ".local", "state", "git-orchard");

export const log = new Logger({
  dir: defaultDir,
  file: join(defaultDir, "debug.log"),
});
